/**
 * Product Validators
 *
 * Joi schemas for product CRUD operations.
 * Used via validate() middleware in product.routes.js.
 */

import Joi from 'joi';

export const createProductSchema = Joi.object({
    name: Joi.string().trim().max(200).required(),
    description: Joi.string().trim().max(5000).required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().trim().required(),
    stock: Joi.number().integer().min(0).default(0),
    images: Joi.array().items(Joi.string().uri().trim()).max(10).default([]),
    tags: Joi.array().items(Joi.string().trim().lowercase()).max(20).default([]),
});

export const updateProductSchema = Joi.object({
    name: Joi.string().trim().max(200),
    description: Joi.string().trim().max(5000),
    price: Joi.number().min(0),
    category: Joi.string().trim(),
    stock: Joi.number().integer().min(0),
    images: Joi.array().items(Joi.string().uri().trim()).max(10),
    tags: Joi.array().items(Joi.string().trim().lowercase()).max(20),
    isActive: Joi.boolean(),
}).min(1); // At least one field required for update

export const listProductsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().trim(),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    search: Joi.string().trim().max(200),
    sortBy: Joi.string().valid('price', 'name', 'createdAt', 'averageRating').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    tags: Joi.string().trim(), // Comma-separated tag list
    isActive: Joi.boolean(),
});
