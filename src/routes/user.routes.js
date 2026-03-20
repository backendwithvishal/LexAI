/**
 * User Routes
 *
 * Base path: /api/v1/users  (mounted in routes/index.js)
 *
 * /me endpoints — for the currently authenticated user's own profile.
 * /:id endpoint — admin-only lookup of any user by ID.
 *
 * Note: email changes are NOT supported here — they require a separate
 * verification flow to prevent account takeover.
 */

import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as userValidator from '../validators/user.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// Get current user's profile (includes quota info)
router.get('/me', authenticate, asyncWrapper(userController.getProfile));
// Update profile — only 'name' is allowed
router.patch('/me', authenticate, validate(userValidator.updateProfile), asyncWrapper(userController.updateProfile));
// Change password — requires current password for verification
router.patch('/me/password', authenticate, validate(userValidator.changePassword), asyncWrapper(userController.changePassword));
// Admin-only: look up any user by ID
router.get('/:id', authenticate, authorize('admin'), asyncWrapper(userController.getUserById));

export default router;
