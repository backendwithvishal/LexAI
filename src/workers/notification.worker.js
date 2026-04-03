/**
 * Notification Worker
 *
 * RabbitMQ consumer that processes events from the notification queue:
 *   - order_created → creates notification + triggers Socket.IO emission
 *   - order_updated → creates notification + triggers Socket.IO emission
 *   - review_added  → creates notification for product owner
 *
 * Communicates with the API process via Redis Pub/Sub (worker → API → Socket.IO).
 */

import { getChannel } from '../config/rabbitmq.js';
import { getRedisClient } from '../config/redis.js';
import { QUEUES, PUBSUB_CHANNEL } from '../constants/queues.js';
import Notification from '../models/Notification.model.js';
import Product from '../models/Product.model.js';
import logger from '../utils/logger.js';

/**
 * Start consuming from the notification queue.
 */
export async function startNotificationWorker() {
    const channel = getChannel();
    if (!channel) {
        logger.error('Notification worker: RabbitMQ channel not available');
        return;
    }

    const queue = QUEUES.NOTIFICATION;

    // Assert the queue (idempotent — safe to call even if already created)
    await channel.assertQueue(queue, { durable: true });

    logger.info(`🔔 Notification worker consuming from: ${queue}`);

    channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
            const { eventType, payload, timestamp } = JSON.parse(msg.content.toString());
            logger.debug(`Notification worker received: ${eventType}`, payload);

            await processNotificationEvent(eventType, payload, timestamp);
            channel.ack(msg);
        } catch (err) {
            logger.error('Notification worker error:', err.message);
            // Reject and don't requeue — prevents infinite loops on bad messages
            channel.nack(msg, false, false);
        }
    });
}

/**
 * Process a notification event based on its type.
 */
async function processNotificationEvent(eventType, payload, timestamp) {
    let notification;

    switch (eventType) {
        case 'order_created': {
            notification = await Notification.create({
                userId: payload.userId,
                orgId: payload.userId, // Use userId as fallback for orgId
                type: 'order_created',
                channel: 'socket',
                resourceType: 'Order',
                resourceId: payload.orderId,
                message: `Your order has been placed successfully. Total: $${payload.totalAmount}`,
                metadata: {
                    orderId: payload.orderId,
                    totalAmount: payload.totalAmount,
                    itemCount: payload.itemCount,
                    status: payload.status,
                },
            });
            break;
        }

        case 'order_updated': {
            notification = await Notification.create({
                userId: payload.userId,
                orgId: payload.userId,
                type: 'order_updated',
                channel: 'socket',
                resourceType: 'Order',
                resourceId: payload.orderId,
                message: `Your order status has been updated: ${payload.previousStatus} → ${payload.status}`,
                metadata: {
                    orderId: payload.orderId,
                    status: payload.status,
                    previousStatus: payload.previousStatus,
                },
            });
            break;
        }

        case 'review_added': {
            // Notify the product owner about a new review
            const product = await Product.findById(payload.productId).select('userId name').lean();
            if (product && product.userId.toString() !== payload.userId.toString()) {
                notification = await Notification.create({
                    userId: product.userId,
                    orgId: product.userId,
                    type: 'review_added',
                    channel: 'socket',
                    resourceType: 'Review',
                    resourceId: payload.reviewId,
                    message: `Your product "${product.name}" received a new ${payload.rating}-star review.`,
                    metadata: {
                        productId: payload.productId,
                        productName: product.name,
                        rating: payload.rating,
                    },
                });
            }
            break;
        }

        default:
            logger.warn(`Notification worker: unknown event type: ${eventType}`);
            return;
    }

    // Bridge to Socket.IO via Redis Pub/Sub
    if (notification) {
        await publishToSocket(notification);
    }
}

/**
 * Publish notification to Redis Pub/Sub so the API process can emit via Socket.IO.
 */
async function publishToSocket(notification) {
    try {
        const redis = getRedisClient();
        const message = JSON.stringify({
            event: 'new_notification',
            room: `user:${notification.userId}`,
            payload: {
                id: notification._id,
                type: notification.type,
                message: notification.message,
                metadata: notification.metadata,
                createdAt: notification.createdAt,
            },
        });
        await redis.publish(PUBSUB_CHANNEL, message);
        logger.debug(`Notification published to Socket.IO: user:${notification.userId}`);
    } catch (err) {
        logger.error('Failed to publish notification to Redis Pub/Sub:', err.message);
    }
}
