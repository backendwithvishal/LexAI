/**
 * Notification Routes
 *
 * Base path: /api/v1/notifications  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 * Notifications are org-scoped — users only see their org's notifications.
 *
 * ⚠️ ROUTE ORDER: Static routes MUST be defined BEFORE dynamic /:id routes
 * to prevent Express from treating "unread-count", "user", and "read-all" as IDs.
 *
 *   GET    /unread-count    — Get unread count for badge display
 *   GET    /user            — List user-specific notifications
 *   PATCH  /read-all        — Mark all notifications as read
 *   GET    /                — List notifications (paginated, filterable by read status)
 *   PATCH  /:id/read        — Mark a single notification as read
 *   DELETE /:id             — Delete a notification
 */

import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as notificationValidator from '../validators/notification.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// ─── Static routes (MUST be before /:id to prevent route conflicts) ──────────
router.get('/unread-count', asyncWrapper(notificationController.getUnreadCount));
router.get('/user', validate(notificationValidator.listNotificationsSchema, 'query'), asyncWrapper(notificationController.getUserNotifications));
router.patch('/read-all', asyncWrapper(notificationController.markAllAsRead));

// ─── List route ──────────────────────────────────────────────────────────────
router.get('/', validate(notificationValidator.listNotificationsSchema, 'query'), asyncWrapper(notificationController.listNotifications));

// ─── Dynamic /:id routes (ObjectId validated) ────────────────────────────────
router.patch('/:id/read', validate(notificationValidator.notificationIdParam, 'params'), asyncWrapper(notificationController.markAsRead));
router.delete('/:id', validate(notificationValidator.notificationIdParam, 'params'), asyncWrapper(notificationController.deleteNotification));

export default router;
