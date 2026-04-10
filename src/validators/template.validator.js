/**
 * Template Validators — Joi schemas for contract template endpoints.
 */

import Joi from 'joi';

/** POST /templates */
export const createTemplate = Joi.object({
    title: Joi.string().trim().min(3).max(300)
        .pattern(/^[^\x00-\x1F\x7F-\x9F<>]+$/, 'no control chars or HTML')  // eslint-disable-line no-control-regex -- intentional
        .required(),
    description: Joi.string().trim().max(1000).optional(),
    content: Joi.string().min(10).max(500_000).required(),
    type: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').default('Other'),
    category: Joi.string().trim().max(100).default('General'),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(20).optional(),
});

/** PATCH /templates/:id */
export const updateTemplate = Joi.object({
    title: Joi.string().trim().min(3).max(300)
        .pattern(/^[^\x00-\x1F\x7F-\x9F<>]+$/, 'no control chars or HTML')  // eslint-disable-line no-control-regex -- intentional
        .optional(),
    description: Joi.string().trim().max(1000).optional(),
    content: Joi.string().min(10).max(500_000).optional(),
    type: Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').optional(),
    category: Joi.string().trim().max(100).optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(20).optional(),
}).min(1);

/** GET /templates — query params */
export const listTemplates = Joi.object({
    page:     Joi.number().integer().min(1).max(1000).default(1),
    limit:    Joi.number().integer().min(1).max(50).default(20),
    type:     Joi.string().valid('NDA', 'Vendor', 'Employment', 'SaaS', 'Other').optional(),
    category: Joi.string().trim().max(100).optional(),
    search:   Joi.string().trim().max(100).optional(),
});
