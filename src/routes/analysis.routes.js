/**
 * Analysis Routes
 *
 * Base path: /api/v1/analyses  (mounted in routes/index.js)
 *
 * All endpoints require authentication + a valid org context.
 *
 *   POST   /analyses                          — Request AI analysis for a contract
 *   GET    /analyses/:id                      — Get a single analysis result by ID
 *   GET    /analyses/contract/:contractId     — Get all analyses for a contract
 *   DELETE /analyses/contract/:contractId     — Permanently delete all analyses for a contract
 *   DELETE /analyses/:id                      — Permanently delete a single analysis by ID
 */

import { Router } from 'express';
import * as analysisController from '../controllers/analysis.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';
import { checkQuota } from '../middleware/quota.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import * as analysisValidator from '../validators/analysis.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All analysis routes require authentication + org membership
router.use(authenticate, requireOrg);

// Request a new AI analysis — stricter limit (AI calls are expensive)
// checkQuota runs before the job is queued to enforce monthly plan limits
router.post(
    '/',
    rateLimiter('analysis'),
    checkQuota,
    validate(analysisValidator.requestAnalysis),
    asyncWrapper(analysisController.requestAnalysis)
);

// NOTE: Routes with static path segments (e.g. /contract/:contractId) MUST be
// declared before dynamic /:id routes to prevent Express matching "contract"
// as a MongoDB ObjectId param.

// Get all analyses for a specific contract
router.get(
    '/contract/:contractId',
    asyncWrapper(analysisController.getAnalysesByContract)
);

// Permanently delete all analyses for a specific contract
router.delete(
    '/contract/:contractId',
    authorize('admin', 'manager'),
    validate(analysisValidator.deleteByContract, 'params'),
    asyncWrapper(analysisController.deleteAnalysesByContract)
);

// Get a single analysis by its ID
router.get(
    '/:id',
    asyncWrapper(analysisController.getAnalysis)
);

// Permanently delete a single analysis by its ID
router.delete(
    '/:id',
    authorize('admin', 'manager'),
    validate(analysisValidator.deleteAnalysis, 'params'),
    asyncWrapper(analysisController.deleteAnalysis)
);

export default router;