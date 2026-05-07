/**
 * Notification Worker
 *
 * RabbitMQ consumer that processes events from the notification queue.
 * Communicates with the API process via Redis Pub/Sub (worker → API → Socket.IO).
 */

import { getChannel } from '../config/rabbitmq.js';
import { getRedisClient } from '../config/redis.js';
import { QUEUES, PUBSUB_CHANNEL } from '../constants/queues.js';
import Notification from '../models/Notification.model.js';
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
            channel.nack(msg, false, false);
        }
    });
}

/**
 * Process a notification event based on its type.
 * Creates a Notification document and pushes a Socket.IO event to the user.
 */
async function processNotificationEvent(eventType, payload, timestamp) {
    const { userId, orgId, title, message, type, metadata } = payload;

    if (!userId && !orgId) {
        logger.warn(`Notification worker: missing userId/orgId for event: ${eventType}`);
        return;
    }

    // Persist the notification to MongoDB
    const notification = await Notification.create({
        userId,
        orgId,
        type: type || eventType,
        title: title || eventType,
        message: message || '',
        metadata: metadata || {},
        read: false,
        createdAt: timestamp ? new Date(timestamp) : new Date(),
    });

    // Push to the user's Socket.IO room via Redis Pub/Sub
    if (userId) {
        await publishToSocket(notification);
    }

    logger.debug(`Notification created and emitted: ${eventType}`, { notificationId: notification._id, userId });
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
