/**
 * Template Routes
 *
 * Base path: /api/v1/templates  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 * Create, update, and delete require admin or manager role.
 *
 *   POST   /               — Create a new template
 *   GET    /               — List templates (org + global)
 *   GET    /:id            — Get template details with content
 *   PATCH  /:id            — Update a template
 *   DELETE /:id            — Soft-delete a template
 *   POST   /:id/clone      — Create a contract from this template
 */

import { Router } from 'express';
import * as templateController from '../controllers/template.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as templateValidator from '../validators/template.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.post('/',          authorize('admin', 'manager'), validate(templateValidator.createTemplate), asyncWrapper(templateController.createTemplate));
router.get('/',           validate(templateValidator.listTemplates, 'query'), asyncWrapper(templateController.listTemplates));
router.get('/:id',        asyncWrapper(templateController.getTemplate));
router.patch('/:id',      authorize('admin', 'manager'), validate(templateValidator.updateTemplate), asyncWrapper(templateController.updateTemplate));
router.delete('/:id',     authorize('admin', 'manager'), asyncWrapper(templateController.deleteTemplate));
router.post('/:id/clone', asyncWrapper(templateController.cloneTemplate));

export default router;
