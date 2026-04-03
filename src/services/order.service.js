/**
 * Order Service
 *
 * Business logic for order operations:
 * - Creates orders with stock validation
 * - Updates order status with state machine enforcement
 * - Emits RabbitMQ events (order_created, order_updated)
 */

import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import { emitOrderCreated, emitOrderUpdated } from './eventProducer.service.js';
import HTTP from '../constants/httpStatus.js';
import logger from '../utils/logger.js';

// Valid status transitions — enforces order lifecycle
const VALID_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],    // Terminal state
    cancelled: [],    // Terminal state
};

/**
 * Create a new order.
 * Validates stock availability, calculates total, decrements stock.
 */
export async function createOrder(userId, data) {
    const { items, shippingAddress, paymentMethod } = data;

    // Resolve products and validate stock
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true });

    if (products.length !== productIds.length) {
        throw new AppError(
            'One or more products not found or inactive.',
            HTTP.BAD_REQUEST,
            'INVALID_PRODUCTS'
        );
    }

    // Build order items with resolved prices and check stock
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    let totalAmount = 0;
    const resolvedItems = [];

    for (const item of items) {
        const product = productMap.get(item.productId);

        if (product.stock < item.quantity) {
            throw new AppError(
                `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}.`,
                HTTP.BAD_REQUEST,
                'INSUFFICIENT_STOCK'
            );
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        resolvedItems.push({
            productId: product._id,
            name: product.name,
            quantity: item.quantity,
            price: product.price,
        });
    }

    // Decrement stock atomically
    const stockUpdates = items.map((item) =>
        Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: -item.quantity } },
            { new: true }
        )
    );
    await Promise.all(stockUpdates);

    // Create the order
    const order = await Order.create({
        userId,
        items: resolvedItems,
        totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimals
        shippingAddress,
        paymentMethod,
    });

    // Emit RabbitMQ event
    emitOrderCreated(order);

    logger.info(`Order created: ${order._id} by user ${userId} — $${totalAmount}`);
    return order;
}

/**
 * List orders for a user with pagination and filtering.
 */
export async function listUserOrders(userId, query) {
    const {
        page = 1,
        limit = 20,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = query;

    const filter = { userId };
    if (status) filter.status = status;

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Order.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, parseInt(page), parseInt(limit));
    return { orders, meta };
}

/**
 * Get a specific order by ID (must belong to the requesting user).
 */
export async function getOrderById(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) {
        throw new AppError('Order not found.', HTTP.NOT_FOUND, 'NOT_FOUND');
    }
    return order;
}

/**
 * Update order status with state machine enforcement.
 */
export async function updateOrderStatus(orderId, userId, newStatus) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
        throw new AppError('Order not found.', HTTP.NOT_FOUND, 'NOT_FOUND');
    }

    const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
        throw new AppError(
            `Cannot transition from "${order.status}" to "${newStatus}". Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}.`,
            HTTP.BAD_REQUEST,
            'INVALID_STATUS_TRANSITION'
        );
    }

    const previousStatus = order.status;
    order.status = newStatus;
    await order.save();

    // Emit RabbitMQ event
    emitOrderUpdated(order, previousStatus);

    logger.info(`Order ${orderId} status: ${previousStatus} → ${newStatus}`);
    return order;
}

/**
 * Cancel an order (only from pending or confirmed states).
 */
export async function cancelOrder(orderId, userId, reason) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
        throw new AppError('Order not found.', HTTP.NOT_FOUND, 'NOT_FOUND');
    }

    const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes('cancelled')) {
        throw new AppError(
            `Order cannot be cancelled from "${order.status}" state.`,
            HTTP.BAD_REQUEST,
            'INVALID_STATUS_TRANSITION'
        );
    }

    const previousStatus = order.status;
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by user';
    await order.save();

    // Restore stock for cancelled orders
    const stockRestorations = order.items.map((item) =>
        Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.quantity } }
        )
    );
    await Promise.all(stockRestorations);

    // Emit RabbitMQ event
    emitOrderUpdated(order, previousStatus);

    logger.info(`Order ${orderId} cancelled by user ${userId}`);
    return order;
}

/**
 * Get order stats for the authenticated user.
 */
export async function getOrderStats(userId) {
    const stats = await Order.aggregate([
        { $match: { userId: userId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
            },
        },
    ]);

    // Also get overall stats
    const overall = await Order.aggregate([
        { $match: { userId: userId } },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$totalAmount' },
                averageOrderValue: { $avg: '$totalAmount' },
            },
        },
    ]);

    return {
        byStatus: stats,
        overall: overall[0] || { totalOrders: 0, totalSpent: 0, averageOrderValue: 0 },
    };
}
