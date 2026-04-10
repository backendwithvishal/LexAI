/**
 * Admin Routes
 *
 * Base path: /api/v1/admin  (mounted in routes/index.js)
 *
 * All routes require:
 *   1. Valid access token (authenticate)
 *   2. admin role (authorize)
 *   3. Strict rate limit — 5 req / 15 min (prevents scraping)
 *
 * Routes:
 *   GET    /stats                — Platform-wide usage stats
 *   GET    /queue/status         — RabbitMQ queue health
 *   GET    /users                — Paginated user list
 *   POST   /users                — Create a user directly (pre-verified, no OTP)
 *   PATCH  /users/:id            — Update user name, role, or active status
 *   DELETE /users/:id            — Deactivate a user (soft delete)
 *   DELETE /users/:id/sessions   — Force-revoke all active sessions for a user
 *   DELETE /contracts/:id        — Permanently delete any contract (platform-wide)
 *   DELETE /organizations/:id    — Delete an org and cascade-clean its data
 *   DELETE /analyses/:id         — Permanently delete any analysis (platform-wide)
 *   DELETE /templates/:id        — Soft-delete any template including global ones
 *   DELETE /comments/:id         — Hard-delete any comment platform-wide
 *   GET    /audit-logs           — Global audit trail
 *
 * These endpoints are for internal dashboards only — not exposed to regular users.
 */

import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// Apply auth + role check + rate limit to ALL admin routes
router.use(authenticate, authorize('admin'), rateLimiter('strict'));

router.get('/stats',        asyncWrapper(adminController.getStats));        // Platform-wide usage stats
router.get('/queue/status', asyncWrapper(adminController.getQueueStatus));  // RabbitMQ queue health
router.get('/users',        asyncWrapper(adminController.listUsers));       // Paginated user list
router.post('/users',       asyncWrapper(adminController.createUser));      // Create user (no OTP)
router.patch('/users/:id',  asyncWrapper(adminController.updateUser));      // Update role/status/name
router.delete('/users/:id', asyncWrapper(adminController.deactivateUser));  // Soft-deactivate user
router.delete('/users/:id/sessions', asyncWrapper(adminController.revokeUserSessions)); // Force-revoke all sessions
router.delete('/contracts/:id',     asyncWrapper(adminController.deleteContract));      // Hard-delete any contract
router.delete('/organizations/:id', asyncWrapper(adminController.deleteOrganization));  // Delete org + cascade
router.delete('/analyses/:id',      asyncWrapper(adminController.deleteAnalysis));      // Hard-delete any analysis
router.delete('/templates/:id',     asyncWrapper(adminController.deleteTemplate));      // Soft-delete any template
router.delete('/comments/:id',      asyncWrapper(adminController.deleteComment));       // Hard-delete any comment
router.get('/audit-logs',   asyncWrapper(adminController.getAuditLogs));    // Global audit trail

export default router;
