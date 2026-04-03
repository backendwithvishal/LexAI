/**
 * Event Producer Service
 *
 * Centralized RabbitMQ event publisher for all new modules.
 * Wraps publishToQueue with structured event payloads and
 * graceful error handling (logs but doesn't crash on failure).
 *
 * Used by: order.service.js, review.service.js, product.service.js
 * Consumed by: notification.worker.js, analytics.worker.js
 */

import { publishToQueue } from '../config/rabbitmq.js';
import { QUEUES } from '../constants/queues.js';
import logger from '../utils/logger.js';

/**
 * Safely publish an event to a RabbitMQ queue.
 * Logs and swallows errors — event publishing should never crash the request.
 *
 * @param {string} queue - Target queue name
 * @param {string} eventType - Event type identifier
 * @param {object} payload - Event data
 */
function safePublish(queue, eventType, payload) {
    try {
        publishToQueue(queue, {
            eventType,
            payload,
            timestamp: new Date().toISOString(),
        });
        logger.debug(`Event published: ${eventType} → ${queue}`);
    } catch (err) {
        logger.error(`Failed to publish event ${eventType}:`, err.message);
        // Don't throw — event publishing is non-critical for the request
    }
}

// ─── Order Events ──────────────────────────────────────────────

export function emitOrderCreated(order) {
    const payload = {
        orderId: order._id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        status: order.status,
    };
    safePublish(QUEUES.NOTIFICATION, 'order_created', payload);
    safePublish(QUEUES.ANALYTICS_EVENTS, 'order_created', payload);
}

export function emitOrderUpdated(order, previousStatus) {
    const payload = {
        orderId: order._id,
        userId: order.userId,
        status: order.status,
        previousStatus,
        totalAmount: order.totalAmount,
    };
    safePublish(QUEUES.NOTIFICATION, 'order_updated', payload);
    safePublish(QUEUES.ANALYTICS_EVENTS, 'order_updated', payload);
}

// ─── Review Events ─────────────────────────────────────────────

export function emitReviewAdded(review) {
    const payload = {
        reviewId: review._id,
        userId: review.userId,
        productId: review.productId,
        rating: review.rating,
    };
    safePublish(QUEUES.NOTIFICATION, 'review_added', payload);
    safePublish(QUEUES.ANALYTICS_EVENTS, 'review_added', payload);
}

// ─── Product Events ────────────────────────────────────────────

export function emitProductCreated(product) {
    const payload = {
        productId: product._id,
        userId: product.userId,
        name: product.name,
        price: product.price,
        category: product.category,
    };
    safePublish(QUEUES.ANALYTICS_EVENTS, 'product_created', payload);
}

export function emitProductUpdated(product) {
    const payload = {
        productId: product._id,
        userId: product.userId,
        name: product.name,
        price: product.price,
        category: product.category,
    };
    safePublish(QUEUES.ANALYTICS_EVENTS, 'product_updated', payload);
}
