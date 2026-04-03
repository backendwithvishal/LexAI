/**
 * Review Service
 *
 * Business logic for product reviews:
 * - One review per user per product enforcement
 * - Async rating recalculation on the Product model
 * - RabbitMQ event emission for notifications and analytics
 */

import Review from '../models/Review.model.js';
import Product from '../models/Product.model.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import { emitReviewAdded } from './eventProducer.service.js';
import HTTP from '../constants/httpStatus.js';
import logger from '../utils/logger.js';

/**
 * Add a review for a product.
 * Enforces one review per user per product via unique index.
 */
export async function addReview(userId, data) {
    const { productId, rating, title, comment } = data;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError('Product not found.', HTTP.NOT_FOUND, 'NOT_FOUND');
    }

    // Create review (unique index will throw on duplicate)
    let review;
    try {
        review = await Review.create({ userId, productId, rating, title, comment });
    } catch (err) {
        if (err.code === 11000) {
            throw new AppError(
                'You have already reviewed this product.',
                HTTP.CONFLICT,
                'DUPLICATE_REVIEW'
            );
        }
        throw err;
    }

    // Trigger async rating recalculation (fire and forget)
    recalculateProductRating(productId).catch((err) => {
        logger.error(`Rating recalculation failed for product ${productId}:`, err.message);
    });

    // Emit RabbitMQ event
    emitReviewAdded(review);

    logger.info(`Review added: product=${productId} user=${userId} rating=${rating}`);
    return review;
}

/**
 * Get reviews for a specific product with pagination.
 */
export async function getProductReviews(productId, query) {
    const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = query;

    const filter = { productId };
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate('userId', 'name email')  // Include reviewer info
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Review.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, parseInt(page), parseInt(limit));
    return { reviews, meta };
}

/**
 * Delete a review (only by the review author).
 */
export async function deleteReview(reviewId, userId) {
    const review = await Review.findOneAndDelete({ _id: reviewId, userId });

    if (!review) {
        throw new AppError(
            'Review not found or you are not the author.',
            HTTP.NOT_FOUND,
            'NOT_FOUND'
        );
    }

    // Trigger async rating recalculation after deletion
    recalculateProductRating(review.productId).catch((err) => {
        logger.error(`Rating recalculation failed for product ${review.productId}:`, err.message);
    });

    logger.info(`Review deleted: ${reviewId} by user ${userId}`);
    return review;
}

/**
 * Get all reviews by the authenticated user.
 */
export async function getUserReviews(userId, query) {
    const { page = 1, limit = 20 } = query;
    const filter = { userId };
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate('productId', 'name price images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Review.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, parseInt(page), parseInt(limit));
    return { reviews, meta };
}

/**
 * Recalculate the average rating for a product.
 * Uses MongoDB aggregation for accuracy.
 * Called asynchronously after review add/delete.
 */
async function recalculateProductRating(productId) {
    const result = await Review.aggregate([
        { $match: { productId: productId } },
        {
            $group: {
                _id: '$productId',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    if (result.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            averageRating: Math.round(result[0].averageRating * 10) / 10,
            totalReviews: result[0].totalReviews,
        });
    } else {
        // No reviews left — reset to 0
        await Product.findByIdAndUpdate(productId, {
            averageRating: 0,
            totalReviews: 0,
        });
    }

    logger.debug(`Rating recalculated for product ${productId}`);
}
