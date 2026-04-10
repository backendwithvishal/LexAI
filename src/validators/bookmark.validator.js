/**
 * Bookmark Validators — Joi schemas for bookmark endpoints.
 */

import Joi from 'joi';

/** POST /bookmarks */
export const createBookmark = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({
            'any.required': 'Contract ID is required.',
            'string.hex': 'Invalid contract ID format.',
            'string.length': 'Invalid contract ID format.',
        }),
    note: Joi.string().trim().max(500).optional(),
});

/** GET /bookmarks — query params */
export const listBookmarks = Joi.object({
    page:  Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
});
