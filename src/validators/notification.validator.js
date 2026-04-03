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
