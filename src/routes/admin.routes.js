/**
 * Admin Routes
 *
 * Base path: /api/v1/admin  (mounted in routes/index.js)
 *
 * All routes require:
 *   1. Valid JWT (authenticate)
 *   2. admin role (authorize)
 *   3. Strict rate limit — 5 req / 15 min (prevents scraping)
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
router.get('/audit-logs',   asyncWrapper(adminController.getAuditLogs));    // Global audit trail

export default router;
