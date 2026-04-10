/**
 * Report Routes
 *
 * Base path: /api/v1/reports  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 * Reports are read-only aggregation endpoints — no data mutation.
 *
 *   GET /compliance   — Compliance summary (analysis coverage, expired contracts)
 *   GET /risk-trend   — Risk score trends over 6 months
 *   GET /activity     — Org activity report (actions, active users, daily counts)
 */

import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.get('/compliance', asyncWrapper(reportController.getComplianceReport));
router.get('/risk-trend', asyncWrapper(reportController.getRiskTrendReport));
router.get('/activity',   asyncWrapper(reportController.getActivityReport));

export default router;
