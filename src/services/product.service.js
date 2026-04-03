/**
 * Product Service
 *
 * Business logic for product CRUD operations.
 * Handles pagination, filtering, sorting, full-text search,
 * and emits RabbitMQ events on create/update.
 */

import Product from '../models/Product.model.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import { emitProductCreated, emitProductUpdated } from './eventProducer.service.js';
import HTTP from '../constants/httpStatus.js';
import logger from '../utils/logger.js';

/**
 * Create a new product.
 */
export async function createProduct(userId, data) {
    const product = await Product.create({ ...data, userId });

    // Emit event for analytics
    emitProductCreated(product);

    logger.info(`Product created: ${product._id} by user ${userId}`);
    return product;
}

/**
 * List products with pagination, filtering, sorting, and search.
 */
export async function listProducts(query) {
    const {
        page = 1,
        limit = 20,
        category,
        minPrice,
        maxPrice,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        tags,
        isActive,
    } = query;

    const filter = {};

    // Default to active products unless explicitly filtering
    if (isActive !== undefined) {
        filter.isActive = isActive;
    } else {
        filter.isActive = true;
    }

    if (category) filter.category = category.toLowerCase();

    if (minPrice !== undefined || maxPrice !== undefined) {
        filter.price = {};
        if (minPrice !== undefined) filter.price.$gte = minPrice;
        if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    if (tags) {
        const tagList = tags.split(',').map((t) => t.trim().toLowerCase());
        filter.tags = { $in: tagList };
    }

    // Full-text search on name + description
    if (search) {
        filter.$text = { $search: search };
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
        Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Product.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, parseInt(page), parseInt(limit));
    return { products, meta };
}

/**
 * Get a product by ID.
 */
export async function getProductById(productId) {
    const product = await Product.findById(productId).lean();
    if (!product) {
        throw new AppError('Product not found.', HTTP.NOT_FOUND, 'NOT_FOUND');
    }
    return product;
}

/**
 * Update a product (only by the owner).
 */
export async function updateProduct(productId, userId, data) {
    const product = await Product.findOneAndUpdate(
        { _id: productId, userId },
        { $set: data },
        { new: true, runValidators: true }
    );

    if (!product) {
        throw new AppError(
            'Product not found or you are not the owner.',
            HTTP.NOT_FOUND,
            'NOT_FOUND'
        );
    }

    // Emit event for analytics
    emitProductUpdated(product);

    logger.info(`Product updated: ${productId}`);
    return product;
}

/**
 * Delete a product (only by the owner). Hard delete.
 */
export async function deleteProduct(productId, userId) {
    const product = await Product.findOneAndDelete({ _id: productId, userId });

    if (!product) {
        throw new AppError(
            'Product not found or you are not the owner.',
            HTTP.NOT_FOUND,
            'NOT_FOUND'
        );
    }

    logger.info(`Product deleted: ${productId}`);
    return product;
}

/**
 * Search products by name/description (dedicated search endpoint).
 */
export async function searchProducts(query) {
    const { search, page = 1, limit = 20 } = query;

    if (!search) {
        throw new AppError('Search query is required.', HTTP.BAD_REQUEST, 'VALIDATION_ERROR');
    }

    const filter = {
        $text: { $search: search },
        isActive: true,
    };

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
        Product.find(filter, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Product.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, parseInt(page), parseInt(limit));
    return { products, meta };
}
