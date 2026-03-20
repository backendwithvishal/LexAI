/**
 * Organization Routes
 *
 * Base path: /api/v1/orgs  (mounted in routes/index.js)
 *
 * Creating an org is open to any authenticated user.
 * Updating org settings requires admin or manager role.
 * Role changes and member removal require admin role only.
 * Accepting an invitation is public — the token in the body is the auth mechanism.
 */

import { Router } from 'express';
import * as orgController from '../controllers/org.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as orgValidator from '../validators/org.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// Create org — any authenticated user can create one
router.post('/', authenticate, validate(orgValidator.createOrg), asyncWrapper(orgController.createOrg));
// Get org details — any member can view
router.get('/:orgId', authenticate, asyncWrapper(orgController.getOrg));
// Update org name — admin or manager only
router.patch('/:orgId', authenticate, authorize('admin', 'manager'), validate(orgValidator.updateOrg), asyncWrapper(orgController.updateOrg));

// ─── Invitation routes ────────────────────────────────────────────────────────
// Send invite — admin or manager only
router.post('/:orgId/invite', authenticate, authorize('admin', 'manager'), validate(orgValidator.inviteMember), asyncWrapper(orgController.inviteMember));
// Accept invite — public (token in body is the auth mechanism, no JWT needed)
router.post('/:orgId/invite/accept', validate(orgValidator.acceptInvite), asyncWrapper(orgController.acceptInvite));

// ─── Member management ────────────────────────────────────────────────────────
// Change role — admin only (can't change your own role)
router.patch('/:orgId/members/:userId/role', authenticate, authorize('admin'), validate(orgValidator.updateMemberRole), asyncWrapper(orgController.changeMemberRole));
// Remove member — admin only (can't remove yourself)
router.delete('/:orgId/members/:userId', authenticate, authorize('admin'), asyncWrapper(orgController.removeMember));

export default router;
