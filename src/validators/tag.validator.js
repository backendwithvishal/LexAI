/**
 * Tag Validators — Joi schemas for tag management endpoints.
 */

import Joi from 'joi';

/** PATCH /tags/rename */
export const renameTag = Joi.object({
    oldTag: Joi.string().trim().lowercase().min(1).max(50).required()
        .messages({ 'any.required': 'Old tag name is required.' }),
    newTag: Joi.string().trim().lowercase().min(1).max(50).required()
        .messages({ 'any.required': 'New tag name is required.' }),
});

/** DELETE /tags/:tag — validated via params */
export const deleteTag = Joi.object({
    tag: Joi.string().trim().min(1).max(50).required()
        .messages({ 'any.required': 'Tag name is required.' }),
});
