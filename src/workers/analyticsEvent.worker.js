/**
 * Analytics Event Worker
 *
 * RabbitMQ consumer that processes events for analytics aggregation:
 *   - order_created → logs order event for sales analytics
 *   - order_updated → tracks status changes
 *   - review_added  → tracks review activity
 *   - product_created → tracks product additions
 *   - product_updated → tracks product changes
 *
 * Performs async aggregation by logging events for later querying.
 * The analytics service uses MongoDB aggregation pipelines on the
 * raw Order/Product/Review collections — this worker provides
 * supplementary event tracking for audit and time-series analysis.
 *
 * NOTE: Named analyticsEvent.worker.js to avoid collision with
 * the existing analysis.worker.js (AI analysis consumer).
 */

import { getChannel } from '../config/rabbitmq.js';
import { QUEUES } from '../constants/queues.js';
import logger from '../utils/logger.js';

/**
 * Start consuming from the analytics event queue.
 */
export async function startAnalyticsEventWorker() {
    const channel = getChannel();
    if (!channel) {
        logger.error('Analytics event worker: RabbitMQ channel not available');
        return;
    }

    const queue = QUEUES.ANALYTICS_EVENTS;

    // Assert the queue (idempotent)
    await channel.assertQueue(queue, { durable: true });

    logger.info(`📊 Analytics event worker consuming from: ${queue}`);

    channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
            const { eventType, payload, timestamp } = JSON.parse(msg.content.toString());
            logger.debug(`Analytics event worker received: ${eventType}`, payload);

            await processAnalyticsEvent(eventType, payload, timestamp);
            channel.ack(msg);
        } catch (err) {
            logger.error('Analytics event worker error:', err.message);
            // Reject without requeue — bad messages go to DLQ or are discarded
            channel.nack(msg, false, false);
        }
    });
}

/**
 * Process an analytics event.
 * Currently logs events for audit/debugging. The actual analytics
 * data is aggregated at query time from the raw collections
 * (Order, Product, Review) by analytics.service.js.
 *
 * Future enhancement: store events in a dedicated AnalyticsEvent
 * collection for time-series analysis and dashboards.
 */
async function processAnalyticsEvent(eventType, payload, timestamp) {
    switch (eventType) {
        case 'order_created':
            logger.info(`📊 Analytics: Order created — $${payload.totalAmount}, ${payload.itemCount} items`, {
                orderId: payload.orderId,
                userId: payload.userId,
            });
            break;

        case 'order_updated':
            logger.info(`📊 Analytics: Order updated — ${payload.previousStatus} → ${payload.status}`, {
                orderId: payload.orderId,
            });
            break;

        case 'review_added':
            logger.info(`📊 Analytics: Review added — ${payload.rating} stars`, {
                productId: payload.productId,
                userId: payload.userId,
            });
            break;

        case 'product_created':
            logger.info(`📊 Analytics: Product created — "${payload.name}" ($${payload.price})`, {
                productId: payload.productId,
                category: payload.category,
            });
            break;

        case 'product_updated':
            logger.info(`📊 Analytics: Product updated — "${payload.name}"`, {
                productId: payload.productId,
            });
            break;

        default:
            logger.warn(`Analytics event worker: unknown event type: ${eventType}`);
    }
}
