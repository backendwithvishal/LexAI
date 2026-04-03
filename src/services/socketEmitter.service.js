/**
 * Socket Emitter Service
 *
 * Dedicated service for emitting Socket.IO events to user-specific rooms.
 * Keeps socket logic OUT of controllers — controllers never touch io directly.
 *
 * Uses getIO() from src/config/socket.js and emits to `user:<userId>` rooms.
 * Called by notification.worker.js after creating notification documents.
 */

import { getIO } from '../config/socket.js';
import SOCKET_EVENTS from '../sockets/events.js';
import logger from '../utils/logger.js';

/**
 * Emit a new notification event to a specific user's room.
 *
 * @param {string} userId - Target user ID
 * @param {object} notification - Notification data to send
 */
export function emitNewNotification(userId, notification) {
    try {
        const io = getIO();
        io.to(`user:${userId}`).emit(SOCKET_EVENTS.NEW_NOTIFICATION, notification);
        logger.debug(`Socket emitted: ${SOCKET_EVENTS.NEW_NOTIFICATION} → user:${userId}`);
    } catch (err) {
        logger.error('Failed to emit new_notification:', err.message);
    }
}

/**
 * Emit an order status update event to a specific user's room.
 *
 * @param {string} userId - Target user ID
 * @param {object} data - Order status update data
 */
export function emitOrderStatusUpdated(userId, data) {
    try {
        const io = getIO();
        io.to(`user:${userId}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED, data);
        logger.debug(`Socket emitted: ${SOCKET_EVENTS.ORDER_STATUS_UPDATED} → user:${userId}`);
    } catch (err) {
        logger.error('Failed to emit order_status_updated:', err.message);
    }
}

/**
 * Emit an event to a specific room (generic helper for flexibility).
 *
 * @param {string} room - Room name (e.g., 'user:abc123', 'admin')
 * @param {string} event - Socket.IO event name
 * @param {object} data - Event payload
 */
export function emitToRoom(room, event, data) {
    try {
        const io = getIO();
        io.to(room).emit(event, data);
        logger.debug(`Socket emitted: ${event} → ${room}`);
    } catch (err) {
        logger.error(`Failed to emit ${event} to ${room}:`, err.message);
    }
}
