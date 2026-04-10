/**
 * Bulk Operation Validators — Joi schemas for batch operations.
 *
 * Enforces array size limits to prevent abuse and excessive DB load.
 */

import Joi from 'joi';

const contractIdArray = Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1).max(100)
    .required()
    .messages({
        'array.min': 'At least one contract ID is required.',
        'array.max': 'Cannot process more than 100 contracts at once.',
    });

/** POST /bulk/add-tags */
export const bulkAddTags = Joi.object({
    contractIds: contractIdArray,
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).min(1).max(20).required()
        .messages({ 'array.min': 'At least one tag is required.' }),
});

/** POST /bulk/remove-tags */
export const bulkRemoveTags = Joi.object({
    contractIds: contractIdArray,
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).min(1).max(20).required(),
});

/** POST /bulk/delete */
export const bulkDelete = Joi.object({
    contractIds: Joi.array()
        .items(Joi.string().hex().length(24))
        .min(1).max(50)
        .required()
        .messages({ 'array.max': 'Cannot delete more than 50 contracts at once.' }),
});

/** POST /bulk/update-type */
export const bulkUpdateType = Joi.object({
    contractIds: contractIdArray,
    type: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').required(),
});
