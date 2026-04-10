/**
 * Bulk Operations Routes
 *
 * Base path: /api/v1/bulk  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership + admin/manager role.
 *
 *   POST /add-tags      — Add tags to multiple contracts
 *   POST /remove-tags   — Remove tags from multiple contracts
 *   POST /delete        — Soft-delete multiple contracts
 *   POST /update-type   — Change type for multiple contracts
 */

import { Router } from 'express';
import * as bulkController from '../controllers/bulk.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as bulkValidator from '../validators/bulk.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All bulk operations require auth + org + admin/manager role
router.use(authenticate, requireOrg, authorize('admin', 'manager'));

router.post('/add-tags',     validate(bulkValidator.bulkAddTags), asyncWrapper(bulkController.bulkAddTags));
router.post('/remove-tags',  validate(bulkValidator.bulkRemoveTags), asyncWrapper(bulkController.bulkRemoveTags));
router.post('/delete',       validate(bulkValidator.bulkDelete), asyncWrapper(bulkController.bulkDelete));
router.post('/update-type',  validate(bulkValidator.bulkUpdateType), asyncWrapper(bulkController.bulkUpdateType));

export default router;
