/**
 * Bookmark Routes
 *
 * Base path: /api/v1/bookmarks  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership.
 *
 *   POST   /               — Bookmark a contract
 *   GET    /               — List bookmarked contracts (paginated)
 *   DELETE /:contractId    — Remove a bookmark
 */

import { Router } from 'express';
import * as bookmarkController from '../controllers/bookmark.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as bookmarkValidator from '../validators/bookmark.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate, requireOrg);

router.post('/',              validate(bookmarkValidator.createBookmark), asyncWrapper(bookmarkController.createBookmark));
router.get('/',               validate(bookmarkValidator.listBookmarks, 'query'), asyncWrapper(bookmarkController.listBookmarks));
router.delete('/:contractId', asyncWrapper(bookmarkController.deleteBookmark));

export default router;
