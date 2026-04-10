/**
 * Dashboard Routes
 *
 * Base path: /api/v1/dashboard  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 *
 *   GET /stats              — Org-level contract/analysis statistics
 *   GET /risk-distribution  — Contracts grouped by risk level
 *   GET /expiry-timeline    — Contracts expiring in 30/60/90 days
 *   GET /recent-activity    — Last N audit log entries for the org
 */

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.get('/stats',             asyncWrapper(dashboardController.getStats));
router.get('/risk-distribution', asyncWrapper(dashboardController.getRiskDistribution));
router.get('/expiry-timeline',   asyncWrapper(dashboardController.getExpiryTimeline));
router.get('/recent-activity',   asyncWrapper(dashboardController.getRecentActivity));

export default router;
