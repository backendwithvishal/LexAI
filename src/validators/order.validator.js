/**
 * Order Validators
 *
 * Joi schemas for order CRUD operations.
 * Used via validate() middleware in order.routes.js.
 */

import Joi from 'joi';

const orderItemSchema = Joi.object({
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).required(),
});

const shippingAddressSchema = Joi.object({
    street: Joi.string().trim().max(200),
    city: Joi.string().trim().max(100),
    state: Joi.string().trim().max(100),
    zipCode: Joi.string().trim().max(20),
    country: Joi.string().trim().max(100),
});

export const createOrderSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1).required(),
    shippingAddress: shippingAddressSchema.required(),
    paymentMethod: Joi.string()
        .valid('credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash_on_delivery')
        .default('credit_card'),
});

export const updateOrderStatusSchema = Joi.object({
    status: Joi.string()
        .valid('confirmed', 'shipped', 'delivered')
        .required(),
});

export const listOrdersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
    sortBy: Joi.string().valid('createdAt', 'totalAmount', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
