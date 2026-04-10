/**
 * Tag Routes
 *
 * Base path: /api/v1/tags  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 * Rename and delete require admin or manager role.
 *
 *   GET    /                — List all unique tags with usage counts
 *   PATCH  /rename          — Rename a tag across all contracts
 *   DELETE /:tag            — Remove a tag from all contracts
 */

import { Router } from 'express';
import * as tagController from '../controllers/tag.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as tagValidator from '../validators/tag.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.get('/',       asyncWrapper(tagController.listTags));
router.patch('/rename', authorize('admin', 'manager'), validate(tagValidator.renameTag), asyncWrapper(tagController.renameTag));
router.delete('/:tag',  authorize('admin', 'manager'), validate(tagValidator.deleteTag, 'params'), asyncWrapper(tagController.deleteTag));

export default router;
