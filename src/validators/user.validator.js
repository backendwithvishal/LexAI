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

/**
 * PATCH /users/:id/role — change a user's role (admin only).
 * Only the three system roles are accepted.
 */
export const updateUserRole = Joi.object({
    role: Joi.string().valid('admin', 'manager', 'viewer').required()
        .messages({
            'any.required': 'Role is required.',
            'any.only': 'Role must be one of: admin, manager, viewer.',
        }),
});
