/**
 * Report Service
 *
 * Generates compliance and risk reports for the org.
 * Uses MongoDB aggregation pipelines for time-series and
 * distribution analytics that go beyond simple dashboard stats.
 */

import Contract from '../models/Contract.model.js';
import Analysis from '../models/Analysis.model.js';
import AuditLog from '../models/AuditLog.model.js';

/**
 * Generate a compliance summary report.
 * Shows contracts with/without analyses, expired contracts,
 * and contracts missing key dates.
 */
export async function getComplianceReport(orgId) {
    const [
        totalContracts,
        contractsWithAnalysis,
        contractsWithoutAnalysis,
        expiredContracts,
        missingExpiryDate,
        missingParties,
    ] = await Promise.all([
        Contract.countDocuments({ orgId, isDeleted: false }),
        Analysis.distinct('contractId', { orgId, status: 'completed' }).then((ids) => ids.length),
        // Contracts that have NEVER been analyzed
        Contract.countDocuments({
            orgId,
            isDeleted: false,
            _id: { $nin: await Analysis.distinct('contractId', { orgId }) },
        }),
        Contract.countDocuments({
            orgId,
            isDeleted: false,
            expiryDate: { $lt: new Date() },
        }),
        Contract.countDocuments({
            orgId,
            isDeleted: false,
            $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }],
        }),
        Contract.countDocuments({
            orgId,
            isDeleted: false,
            $or: [{ parties: { $exists: false } }, { parties: { $size: 0 } }],
        }),
    ]);

    const coveragePercent = totalContracts > 0
        ? Math.round((contractsWithAnalysis / totalContracts) * 100)
        : 0;

    return {
        generatedAt: new Date().toISOString(),
        totalContracts,
        analysisCoverage: {
            analyzed: contractsWithAnalysis,
            unanalyzed: contractsWithoutAnalysis,
            coveragePercent,
        },
        expiryStatus: {
            expired: expiredContracts,
            missingExpiryDate,
        },
        dataCompleteness: {
            missingParties,
            missingExpiryDate,
        },
    };
}

/**
 * Risk trend report — average risk scores over the last 6 months.
 */
export async function getRiskTrendReport(orgId) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trend = await Analysis.aggregate([
        {
            $match: {
                orgId,
                status: 'completed',
                riskScore: { $exists: true },
                createdAt: { $gte: sixMonthsAgo },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                },
                avgRiskScore: { $avg: '$riskScore' },
                maxRiskScore: { $max: '$riskScore' },
                minRiskScore: { $min: '$riskScore' },
                analysisCount: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Risk level distribution over the same period
    const riskDistribution = await Analysis.aggregate([
        {
            $match: {
                orgId,
                status: 'completed',
                riskLevel: { $exists: true },
                createdAt: { $gte: sixMonthsAgo },
            },
        },
        {
            $group: {
                _id: '$riskLevel',
                count: { $sum: 1 },
            },
        },
    ]);

    return {
        generatedAt: new Date().toISOString(),
        period: { from: sixMonthsAgo.toISOString(), to: new Date().toISOString() },
        monthlyTrend: trend.map((t) => ({
            year: t._id.year,
            month: t._id.month,
            avgRiskScore: Math.round(t.avgRiskScore * 10) / 10,
            maxRiskScore: t.maxRiskScore,
            minRiskScore: t.minRiskScore,
            analysisCount: t.analysisCount,
        })),
        riskDistribution: riskDistribution.reduce((acc, r) => {
            acc[r._id] = r.count;
            return acc;
        }, {}),
    };
}

/**
 * Activity report — summary of org activity over a given period.
 */
export async function getActivityReport(orgId, query = {}) {
    const { days = 30 } = query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Action breakdown
    const actionBreakdown = await AuditLog.aggregate([
        { $match: { orgId, createdAt: { $gte: since } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    // Most active users
    const activeUsers = await AuditLog.aggregate([
        { $match: { orgId, createdAt: { $gte: since } } },
        { $group: { _id: '$userId', actionCount: { $sum: 1 } } },
        { $sort: { actionCount: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user',
            },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                name: '$user.name',
                email: '$user.email',
                actionCount: 1,
            },
        },
    ]);

    // Daily activity counts
    const dailyActivity = await AuditLog.aggregate([
        { $match: { orgId, createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return {
        generatedAt: new Date().toISOString(),
        period: { days, since: since.toISOString() },
        totalActions: actionBreakdown.reduce((sum, a) => sum + a.count, 0),
        actionBreakdown: actionBreakdown.map((a) => ({ action: a._id, count: a.count })),
        mostActiveUsers: activeUsers,
        dailyActivity: dailyActivity.map((d) => ({ date: d._id, count: d.count })),
    };
}
