/**
 * Review Controller
 *
 * Thin HTTP layer for review CRUD.
 * All business logic (rating recalculation, duplicate detection) lives in review.service.js.
 */

import * as reviewService from '../services/review.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /reviews — Add a review */
export async function addReview(req, res) {
    const review = await reviewService.addReview(req.user.userId, req.body);
    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        message: 'Review added successfully.',
        data: { review },
    });
}

/** GET /reviews/product/:productId — Get product reviews */
export async function getProductReviews(req, res) {
    const { reviews, meta } = await reviewService.getProductReviews(
        req.params.productId,
        req.query
    );
    sendSuccess(res, { data: { reviews, meta } });
}

/** GET /reviews/my — Get authenticated user's reviews */
export async function getMyReviews(req, res) {
    const { reviews, meta } = await reviewService.getUserReviews(req.user.userId, req.query);
    sendSuccess(res, { data: { reviews, meta } });
}

/** DELETE /reviews/:id — Delete a review (author only) */
export async function deleteReview(req, res) {
    await reviewService.deleteReview(req.params.id, req.user.userId);
    sendSuccess(res, { message: 'Review deleted successfully.' });
}
