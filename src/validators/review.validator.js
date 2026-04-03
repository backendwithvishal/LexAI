/**
 * Review Validators
 *
 * Joi schemas for review CRUD operations.
 * Used via validate() middleware in review.routes.js.
 */

import Joi from 'joi';

export const createReviewSchema = Joi.object({
    productId: Joi.string().hex().length(24).required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().trim().max(200).allow(''),
    comment: Joi.string().trim().max(2000).allow(''),
});

export const listReviewsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'rating').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
