/**
 * Comment Validators — Joi schemas for comment endpoints.
 *
 * Content rejects control characters to prevent invisible/malicious text.
 */

import Joi from 'joi';

/** POST /contracts/:contractId/comments */
export const createComment = Joi.object({
    content: Joi.string().trim().min(1).max(5000)
        .pattern(/^[^\x00-\x08\x0B\x0C\x0E-\x1F]+$/, 'no control chars')  // eslint-disable-line no-control-regex -- intentional
        .required()
        .messages({
            'any.required': 'Comment content is required.',
            'string.min': 'Comment cannot be empty.',
            'string.max': 'Comment must not exceed 5000 characters.',
        }),
});

/** PATCH /contracts/:contractId/comments/:commentId */
export const updateComment = Joi.object({
    content: Joi.string().trim().min(1).max(5000)
        .pattern(/^[^\x00-\x08\x0B\x0C\x0E-\x1F]+$/, 'no control chars')  // eslint-disable-line no-control-regex -- intentional
        .required()
        .messages({
            'any.required': 'Comment content is required.',
            'string.min': 'Comment cannot be empty.',
            'string.max': 'Comment must not exceed 5000 characters.',
        }),
});

/** GET /contracts/:contractId/comments — query params */
export const listComments = Joi.object({
    page:  Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
});
