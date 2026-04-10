/**
 * Share Validators — Joi schemas for contract sharing endpoints.
 */

import Joi from 'joi';

/** POST /shares */
export const createShareLink = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({
            'any.required': 'Contract ID is required.',
            'string.hex': 'Invalid contract ID format.',
        }),
    permissions: Joi.string().valid('view_metadata', 'view_content', 'view_analysis').default('view_metadata'),
    expiryHours: Joi.number().integer().min(1).max(720).default(72) // Max 30 days
        .messages({ 'number.max': 'Share links can last a maximum of 30 days (720 hours).' }),
    password: Joi.string().min(4).max(128).optional(),
    note: Joi.string().trim().max(500).optional(),
});

/** POST /shares/access — public access via token */
export const accessShareLink = Joi.object({
    token: Joi.string().hex().length(64).required()
        .messages({
            'any.required': 'Share token is required.',
            'string.hex': 'Invalid share token format.',
        }),
    password: Joi.string().max(128).optional(),
});
