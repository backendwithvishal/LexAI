/**
 * Analytics Controller
 *
 * Thin HTTP layer for analytics endpoints.
 * All aggregation logic lives in analytics.service.js.
 * Admin-only — requires authorize('admin') middleware.
 */

import * as analyticsService from '../services/analytics.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /analytics/sales — Sales analytics */
export async function getSalesAnalytics(req, res) {
    const data = await analyticsService.getSalesAnalytics(req.query);
    sendSuccess(res, { data });
}

/** GET /analytics/products — Product performance analytics */
export async function getProductAnalytics(req, res) {
    const data = await analyticsService.getProductAnalytics(req.query);
    sendSuccess(res, { data });
}

/** GET /analytics/users — User activity analytics */
export async function getUserActivityAnalytics(req, res) {
    const data = await analyticsService.getUserActivityAnalytics(req.query);
    sendSuccess(res, { data });
}

/** GET /analytics/revenue — Revenue trend analytics */
export async function getRevenueAnalytics(req, res) {
    const data = await analyticsService.getRevenueAnalytics(req.query);
    sendSuccess(res, { data });
}

/** GET /analytics/top-products — Top products by sales */
export async function getTopProducts(req, res) {
    const data = await analyticsService.getTopProducts(req.query);
    sendSuccess(res, { data });
}
