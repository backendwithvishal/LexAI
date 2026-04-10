/**
 * Dashboard Service
 *
 * Org-scoped analytics and statistics for the user dashboard.
 * All queries are filtered by orgId for multi-tenant isolation.
 * Heavy aggregation queries use lean() for performance.
 */

import Contract from '../models/Contract.model.js';
import Analysis from '../models/Analysis.model.js';
import AuditLog from '../models/AuditLog.model.js';
import Comment from '../models/Comment.model.js';

/**
 * Get org-level contract and analysis statistics.
 */
export async function getOrgStats(orgId) {
    const [
        totalContracts,
        activeContracts,
        totalAnalyses,
        completedAnalyses,
        pendingAnalyses,
        totalComments,
    ] = await Promise.all([
        Contract.countDocuments({ orgId }),
        Contract.countDocuments({ orgId, isDeleted: false }),
        Analysis.countDocuments({ orgId }),
        Analysis.countDocuments({ orgId, status: 'completed' }),
        Analysis.countDocuments({ orgId, status: { $in: ['pending', 'processing'] } }),
        Comment.countDocuments({ orgId, isDeleted: false }),
    ]);

    // Average risk score for this org's completed analyses
    const riskAgg = await Analysis.aggregate([
        { $match: { orgId, status: 'completed', riskScore: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$riskScore' } } },
    ]);
    const averageRiskScore = riskAgg[0]?.avg ? Math.round(riskAgg[0].avg * 10) / 10 : 0;

    // Contracts by type breakdown
    const typeBreakdown = await Contract.aggregate([
        { $match: { orgId, isDeleted: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    return {
        totalContracts,
        activeContracts,
        deletedContracts: totalContracts - activeContracts,
        totalAnalyses,
        completedAnalyses,
        pendingAnalyses,
        totalComments,
        averageRiskScore,
        contractsByType: typeBreakdown.map((t) => ({ type: t._id, count: t.count })),
    };
}

/**
 * Get risk distribution — count of contracts grouped by risk level.
 */
export async function getRiskDistribution(orgId) {
    const distribution = await Analysis.aggregate([
        { $match: { orgId, status: 'completed', riskLevel: { $exists: true } } },
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Ensure all levels are present even if count is 0
    const levels = ['low', 'medium', 'high', 'critical'];
    const result = {};
    for (const level of levels) {
        const found = distribution.find((d) => d._id === level);
        result[level] = found ? found.count : 0;
    }

    return result;
}

/**
 * Get contracts expiring in the next 30, 60, and 90 days.
 */
export async function getExpiryTimeline(orgId) {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [expiring30, expiring60, expiring90, expired] = await Promise.all([
        Contract.countDocuments({ orgId, isDeleted: false, expiryDate: { $gte: now, $lte: in30 } }),
        Contract.countDocuments({ orgId, isDeleted: false, expiryDate: { $gte: now, $lte: in60 } }),
        Contract.countDocuments({ orgId, isDeleted: false, expiryDate: { $gte: now, $lte: in90 } }),
        Contract.countDocuments({ orgId, isDeleted: false, expiryDate: { $lt: now } }),
    ]);

    // Get the actual contracts expiring within 30 days for the urgency list
    const urgentContracts = await Contract.find({
        orgId,
        isDeleted: false,
        expiryDate: { $gte: now, $lte: in30 },
    })
        .select('title type expiryDate')
        .sort({ expiryDate: 1 })
        .limit(10)
        .lean();

    return {
        expired,
        next30Days: expiring30,
        next60Days: expiring60,
        next90Days: expiring90,
        urgentContracts,
    };
}

/**
 * Get recent activity for the org (last N audit log entries).
 */
export async function getRecentActivity(orgId, limit = 20) {
    const logs = await AuditLog.find({ orgId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .lean();

    return logs;
}
