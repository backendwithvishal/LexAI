/**
 * Share Routes
 *
 * Base path: /api/v1/shares  (mounted in routes/index.js)
 *
 * Authenticated endpoints:
 *   POST   /                         — Create a share link
 *   GET    /contract/:contractId     — List share links for a contract
 *   DELETE /:id                      — Revoke a share link
 *
 * Public endpoint (no auth):
 *   POST   /access                   — Access shared contract via token
 */

import { Router } from 'express';
import * as shareController from '../controllers/share.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as shareValidator from '../validators/share.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// ─── Public endpoint — no auth required ──────────────────────────────────────
// This MUST be declared before the authenticate middleware
router.post('/access', validate(shareValidator.accessShareLink), asyncWrapper(shareController.accessSharedContract));

// ─── Authenticated endpoints ─────────────────────────────────────────────────
router.use(authenticate, requireOrg);

router.post('/',                     authorize('admin', 'manager'), validate(shareValidator.createShareLink), asyncWrapper(shareController.createShareLink));
router.get('/contract/:contractId',  asyncWrapper(shareController.listShareLinks));
router.delete('/:id',               authorize('admin', 'manager'), asyncWrapper(shareController.revokeShareLink));

export default router;
