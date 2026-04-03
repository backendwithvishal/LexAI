/**
 * Analytics Service
 *
 * MongoDB aggregation pipelines for business analytics:
 * - Sales analytics (revenue, orders over time)
 * - Product performance (best sellers, ratings)
 * - User activity stats (active users, order frequency)
 * - Revenue trends
 * - Top products by sales volume
 *
 * Admin-only — controllers should enforce authorize('admin').
 */

import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import Review from '../models/Review.model.js';
import User from '../models/User.model.js';
import logger from '../utils/logger.js';

/**
 * Sales analytics — revenue, order count, avg order value, over time.
 */
export async function getSalesAnalytics(query = {}) {
    const { period = '30d' } = query;
    const startDate = getStartDate(period);

    const salesOverTime = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: 'cancelled' },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                },
                totalRevenue: { $sum: '$totalAmount' },
                orderCount: { $sum: 1 },
                avgOrderValue: { $avg: '$totalAmount' },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Overall summary
    const summary = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: 'cancelled' },
            },
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$totalAmount' },
                totalOrders: { $sum: 1 },
                avgOrderValue: { $avg: '$totalAmount' },
                totalItemsSold: { $sum: { $size: '$items' } },
            },
        },
    ]);

    // Orders by status
    const byStatus = await Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return {
        period,
        summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, totalItemsSold: 0 },
        salesOverTime,
        byStatus,
    };
}

/**
 * Product performance analytics.
 */
export async function getProductAnalytics(query = {}) {
    const { limit = 10 } = query;

    // Top products by revenue
    const topByRevenue = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.productId',
                productName: { $first: '$items.name' },
                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                totalUnitsSold: { $sum: '$items.quantity' },
                orderCount: { $sum: 1 },
            },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: parseInt(limit) },
    ]);

    // Product rating distribution
    const ratingDistribution = await Product.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $gte: ['$averageRating', 4] }, then: '4-5 stars' },
                            { case: { $gte: ['$averageRating', 3] }, then: '3-4 stars' },
                            { case: { $gte: ['$averageRating', 2] }, then: '2-3 stars' },
                            { case: { $gte: ['$averageRating', 1] }, then: '1-2 stars' },
                        ],
                        default: 'No reviews',
                    },
                },
                count: { $sum: 1 },
            },
        },
    ]);

    // Category breakdown
    const byCategory = await Product.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: '$category',
                productCount: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                avgRating: { $avg: '$averageRating' },
            },
        },
        { $sort: { productCount: -1 } },
    ]);

    return {
        topByRevenue,
        ratingDistribution,
        byCategory,
    };
}

/**
 * User activity analytics.
 */
export async function getUserActivityAnalytics(query = {}) {
    const { period = '30d' } = query;
    const startDate = getStartDate(period);

    // Total user count
    const totalUsers = await User.countDocuments();

    // New users in period
    const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });

    // Most active buyers (by order count)
    const topBuyers = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: 'cancelled' },
            },
        },
        {
            $group: {
                _id: '$userId',
                orderCount: { $sum: 1 },
                totalSpent: { $sum: '$totalAmount' },
            },
        },
        { $sort: { orderCount: -1 } },
        { $limit: 10 },
    ]);

    // Most active reviewers
    const topReviewers = await Review.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: '$userId',
                reviewCount: { $sum: 1 },
                avgRating: { $avg: '$rating' },
            },
        },
        { $sort: { reviewCount: -1 } },
        { $limit: 10 },
    ]);

    return {
        period,
        totalUsers,
        newUsers,
        topBuyers,
        topReviewers,
    };
}

/**
 * Revenue trend analytics — daily/weekly/monthly breakdowns.
 */
export async function getRevenueAnalytics(query = {}) {
    const { period = '90d', groupBy = 'day' } = query;
    const startDate = getStartDate(period);

    let dateGroup;
    switch (groupBy) {
        case 'week':
            dateGroup = { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } };
            break;
        case 'month':
            dateGroup = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
            break;
        default: // day
            dateGroup = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
            };
    }

    const revenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: 'cancelled' },
            },
        },
        {
            $group: {
                _id: dateGroup,
                revenue: { $sum: '$totalAmount' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    return { period, groupBy, revenue };
}

/**
 * Top products by sales volume.
 */
export async function getTopProducts(query = {}) {
    const { limit = 10, period = '30d' } = query;
    const startDate = getStartDate(period);

    const topProducts = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: 'cancelled' },
            },
        },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.productId',
                name: { $first: '$items.name' },
                totalSold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                orderCount: { $sum: 1 },
            },
        },
        { $sort: { totalSold: -1 } },
        { $limit: parseInt(limit) },
    ]);

    return { period, topProducts };
}

// ─── Helper ────────────────────────────────────────────────────────

function getStartDate(period) {
    const now = new Date();
    const match = period.match(/^(\d+)([dhm])$/);
    if (!match) return new Date(now.setDate(now.getDate() - 30));

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
        case 'd': return new Date(now.setDate(now.getDate() - num));
        case 'h': return new Date(now.setHours(now.getHours() - num));
        case 'm': return new Date(now.setMonth(now.getMonth() - num));
        default: return new Date(now.setDate(now.getDate() - 30));
    }
}
