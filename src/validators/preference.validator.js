/**
 * Preference Validators — Joi schemas for user preference endpoints.
 */

import Joi from 'joi';

/** PUT /preferences */
export const updatePreferences = Joi.object({
    notifications: Joi.object({
        emailOnAnalysisComplete: Joi.boolean(),
        emailOnContractExpiring: Joi.boolean(),
        emailOnCommentAdded: Joi.boolean(),
        emailOnInvitation: Joi.boolean(),
        pushOnAnalysisComplete: Joi.boolean(),
        pushOnContractExpiring: Joi.boolean(),
        pushOnCommentAdded: Joi.boolean(),
    }).optional(),
    display: Joi.object({
        contractsPerPage: Joi.number().integer().min(5).max(50),
        defaultSortBy: Joi.string().valid('createdAt', 'title', 'type', 'expiryDate', 'riskScore'),
        defaultSortOrder: Joi.string().valid('asc', 'desc'),
        showRiskBadges: Joi.boolean(),
    }).optional(),
    defaults: Joi.object({
        contractType: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other'),
        alertDays: Joi.array().items(Joi.number().integer().min(1).max(365)).max(10),
    }).optional(),
    timezone: Joi.string().trim().max(50).optional(),
}).min(1);
