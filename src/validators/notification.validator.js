/**
 * Notification Validators
 *
 * Joi schemas for notification operations.
 * Used via validate() middleware in notification.routes.js.
 */

import Joi from 'joi';

export const listNotificationsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    read: Joi.boolean(),
    type: Joi.string().trim(),
});

/**
 * Validate :id path param as a 24-char hex MongoDB ObjectId.
 * Applied on PATCH /:id/read and DELETE /:id routes.
 */
export const notificationIdParam = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid notification ID format. Must be a 24-character hex string.',
            'any.required': 'Notification ID is required.',
        }),
});
