/**
 * Export Routes
 *
 * Base path: /api/v1/exports  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 *
 *   GET /contracts             — Export contracts list as JSON
 *   GET /contracts/:id/report  — Export single contract + analysis report
 *   GET /analyses              — Export all analyses summary
 */

import { Router } from 'express';
import * as exportController from '../controllers/export.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.get('/contracts',             asyncWrapper(exportController.exportContracts));
router.get('/contracts/:id/report',  asyncWrapper(exportController.exportContractReport));
router.get('/analyses',              asyncWrapper(exportController.exportAnalyses));

export default router;
