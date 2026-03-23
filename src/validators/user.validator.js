/**
 * User Validators — Joi schemas for user profile endpoints.
 */

import Joi from 'joi';

/**
 * PATCH /users/me — update profile.
 * Only 'name' is allowed via this endpoint.
 */
export const updateProfile = Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
        .messages({
            'any.required': 'Name is required.',
            'string.min': 'Name must be at least 2 characters.',
        }),
});
