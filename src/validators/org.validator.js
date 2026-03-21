/**
 * Org Validators — Joi schemas for org endpoints.
 *
 * Name fields reject HTML and control characters to prevent XSS in stored org names.
 * Invitation tokens are UUID v4 strings — min 32 chars covers both UUID and hex formats.
 */

import Joi from 'joi';

export const createOrg = Joi.object({
    name: Joi.string().trim().min(2).max(200)
        .pattern(/^[^\u0000-\u001F\u007F-\u009F<>]+$/, 'no control chars or HTML')
        .required()
        .messages({ 'any.required': 'Organization name is required' }),
});

export const inviteMember = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).lowercase().trim().max(254).required(),
    // Default to viewer — least privilege for new members
    role: Joi.string().valid('admin', 'manager', 'viewer').default('viewer'),
});

export const acceptInvite = Joi.object({
    token: Joi.string().trim().min(32).max(512).required(),
    // name and password are only required for new users (not existing users accepting an invite)
    name: Joi.string().trim().min(2).max(100)
        .pattern(/^[^\u0000-\u001F\u007F-\u009F<>]+$/, 'no control chars or HTML')
        .optional(),
    password: Joi.string().min(8).max(128)
        // Same pattern as auth.validator.js — must match what's accepted at registration
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,\-_#^()])[^\s]+$/)
        .optional()
        .messages({
            'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character.',
        }),
});

export const updateMemberRole = Joi.object({
    // Only these three roles exist in the system
    role: Joi.string().valid('admin', 'manager', 'viewer').required(),
});

export const updateOrg = Joi.object({
    name: Joi.string().trim().min(2).max(200)
        .pattern(/^[^\u0000-\u001F\u007F-\u009F<>]+$/, 'no control chars or HTML')
        .optional(),
}).min(1); // Require at least one field — prevents empty PATCH requests