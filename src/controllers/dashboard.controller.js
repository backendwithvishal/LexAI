/**
 * Dashboard Controller
 *
 * Thin HTTP layer for org-level analytics.
 * All business logic lives in dashboard.service.js.
 */

import * as dashboardService from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /dashboard/stats — org contract/analysis statistics */
export async function getStats(req, res) {
    const { orgId } = req;
    const stats = await dashboardService.getOrgStats(orgId);
    sendSuccess(res, { data: { stats } });
}

/** GET /dashboard/risk-distribution — contracts grouped by risk level */
export async function getRiskDistribution(req, res) {
    const { orgId } = req;
    const distribution = await dashboardService.getRiskDistribution(orgId);
    sendSuccess(res, { data: { distribution } });
}

/** GET /dashboard/expiry-timeline — contracts expiring in 30/60/90 days */
export async function getExpiryTimeline(req, res) {
    const { orgId } = req;
    const timeline = await dashboardService.getExpiryTimeline(orgId);
    sendSuccess(res, { data: { timeline } });
}

/** GET /dashboard/recent-activity — last N audit log entries */
export async function getRecentActivity(req, res) {
    const { orgId } = req;
    const limit = parseInt(req.query.limit) || 20;
    const activity = await dashboardService.getRecentActivity(orgId, limit);
    sendSuccess(res, { data: { activity } });
}
