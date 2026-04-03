/**
 * Notification Routes
 *
 * Base path: /api/v1/notifications  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 * Notifications are org-scoped — users only see their org's notifications.
 *
 *   GET    /                — List notifications (paginated, filterable by read status)
 *   GET    /user            — List user-specific notifications
 *   GET    /unread-count    — Get unread count for badge display
 *   PATCH  /read-all        — Mark all notifications as read
 *   PATCH  /:id/read        — Mark a single notification as read
 *   DELETE /:id             — Delete a notification
 */

import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', asyncWrapper(notificationController.listNotifications));
// user must be before /:id to prevent "user" being matched as an ID
router.get('/user', asyncWrapper(notificationController.getUserNotifications));
// unread-count must be declared BEFORE /:id to prevent "unread-count" being matched as an ID
router.get('/unread-count', asyncWrapper(notificationController.getUnreadCount));
// Bulk mark-as-read — must be before /:id/read to avoid route conflict
router.patch('/read-all', asyncWrapper(notificationController.markAllAsRead));
router.patch('/:id/read', asyncWrapper(notificationController.markAsRead));
router.delete('/:id', asyncWrapper(notificationController.deleteNotification));

export default router;

