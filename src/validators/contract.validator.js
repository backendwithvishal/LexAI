/**
 * Contract Validators — Joi schemas for contract endpoints.
 *
 * Security notes:
 *   - Title rejects HTML tags and control characters to prevent XSS in stored data
 *   - Content is capped at 500KB — prevents memory exhaustion from huge uploads
 *   - Search is capped at 100 chars — limits regex complexity in MongoDB $text queries
 *   - Tags are lowercased at validation time for consistent filtering
 */

import Joi from 'joi';

export const uploadContract = Joi.object({
    title: Joi.string().trim().min(3).max(300)
        .pattern(/^[^\x00-\x1F\x7F-\x9F<>]+$/, 'no control chars or HTML')  // eslint-disable-line no-control-regex -- intentional: block XSS in title
        .required(),
    type: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').default('Other'),
    // Tags can arrive as an array (JSON) or a single string from multipart forms
    tags: Joi.alternatives().try(
        Joi.array().items(Joi.string().trim().lowercase().max(50)).max(20),
        Joi.string().trim().max(50)
    ).optional(),
    content: Joi.string().min(50).max(500_000).optional(), // 500KB text cap — prevents memory issues
    expiryDate: Joi.date().iso().min('now').optional(),    // must be in the future
    jurisdiction: Joi.string().trim().max(100).optional(),
});

export const updateContract = Joi.object({
    title: Joi.string().trim().min(3).max(300)
        .pattern(/^[^\x00-\x1F\x7F-\x9F<>]+$/, 'no control chars or HTML')  // eslint-disable-line no-control-regex -- intentional: block XSS in title
        .optional(),
    type: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(20).optional(),
    // alertDays: which thresholds to send expiry alerts at (e.g., [90, 30, 7])
    alertDays: Joi.array().items(Joi.number().integer().min(1).max(365)).max(10).optional(),
    expiryDate: Joi.date().iso().optional(),
}).min(1); // Require at least one field — prevents empty PATCH requests

export const uploadVersion = Joi.object({
    content: Joi.string().min(50).max(500_000).required(),
    changeNote: Joi.string().trim().max(500).optional(),  // Optional description of what changed
});

export const compareVersions = Joi.object({
    versionA: Joi.number().integer().min(1).required(),
    versionB: Joi.number().integer().min(1).required(),
}).custom((value, helpers) => {
    // Can't compare a version to itself — that would always produce an empty diff
    if (value.versionA === value.versionB) {
        return helpers.error('any.invalid');
    }
    return value;
}).messages({ 'any.invalid': 'versionA and versionB must be different.' });

export const listContracts = Joi.object({
    page:   Joi.number().integer().min(1).max(1000).default(1),
    limit:  Joi.number().integer().min(1).max(50).default(10),  // cap at 50 per page
    sortBy: Joi.string().valid('createdAt', 'title', 'type', 'riskScore', 'expiryDate').default('createdAt'),
    order:  Joi.string().valid('asc', 'desc').default('desc'),
    type:   Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').optional(),
    tag:    Joi.string().trim().lowercase().max(50).optional(),
    // Search is capped at 100 chars to limit MongoDB $text query complexity
    search: Joi.string().trim().max(100).optional(),
});