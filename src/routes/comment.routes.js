/**
 * Comment Routes
 *
 * Base path: /api/v1/contracts/:contractId/comments  (mounted in contract.routes.js)
 *
 * All endpoints require authentication + org membership.
 *
 *   POST   /                 — Add a comment
 *   GET    /                 — List comments (paginated)
 *   PATCH  /:commentId       — Edit own comment
 *   DELETE /:commentId       — Delete own comment (admin can delete any)
 */

import { Router } from 'express';
import * as commentController from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as commentValidator from '../validators/comment.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

// mergeParams: true allows access to :contractId from the parent router
const router = Router({ mergeParams: true });

router.use(authenticate, requireOrg);

router.post('/',              validate(commentValidator.createComment), asyncWrapper(commentController.createComment));
router.get('/',               validate(commentValidator.listComments, 'query'), asyncWrapper(commentController.listComments));
router.patch('/:commentId',   validate(commentValidator.updateComment), asyncWrapper(commentController.updateComment));
router.delete('/:commentId',  asyncWrapper(commentController.deleteComment));

export default router;
