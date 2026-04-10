/**
 * Status Validators — Joi schemas for contract status/workflow endpoints.
 */

import Joi from 'joi';

/** PATCH /contracts/:id/status */
export const updateStatus = Joi.object({
    status: Joi.string()
        .valid('draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated')
        .required()
        .messages({ 'any.required': 'New status is required.' }),
    note: Joi.string().trim().max(500).optional(),
});
