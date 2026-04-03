/**
 * Review Routes
 *
 * Base path: /api/v1/reviews  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 *
 *   POST   /                      — Add a review
 *   GET    /my                    — Get authenticated user's reviews
 *   GET    /product/:productId    — Get reviews for a product
 *   DELETE /:id                   — Delete a review (author only)
 */

import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { createReviewSchema, listReviewsSchema } from '../validators/review.validator.js';

const router = Router();

// All review routes require authentication
router.use(authenticate);

router.post('/', validate(createReviewSchema), asyncWrapper(reviewController.addReview));

// my must be before /:id to prevent "my" being matched as an ID
router.get('/my', asyncWrapper(reviewController.getMyReviews));

router.get('/product/:productId', validate(listReviewsSchema, 'query'), asyncWrapper(reviewController.getProductReviews));
router.delete('/:id', asyncWrapper(reviewController.deleteReview));

export default router;
