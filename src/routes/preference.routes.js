/**
 * Preference Routes
 *
 * Base path: /api/v1/preferences  (mounted in routes/index.js)
 *
 * All endpoints require authentication (user-scoped, no org required).
 *
 *   GET    /     — Get current user's preferences
 *   PUT    /     — Update current user's preferences
 *   DELETE /     — Reset preferences to defaults
 */

import { Router } from 'express';
import * as preferenceController from '../controllers/preference.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as preferenceValidator from '../validators/preference.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate);

router.get('/',    asyncWrapper(preferenceController.getPreferences));
router.put('/',    validate(preferenceValidator.updatePreferences), asyncWrapper(preferenceController.updatePreferences));
router.delete('/', asyncWrapper(preferenceController.resetPreferences));

export default router;
