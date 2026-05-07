/**
 * Admin Controller
 *
 * Platform-wide stats, queue status, and admin-only endpoints.
 * All routes here are protected by authorize('admin') in the router.
 * These endpoints are for internal dashboards — not exposed to regular users.
 */

import User from '../models/User.model.js';
import Organization from '../models/Organization.model.js';
import Contract from '../models/Contract.model.js';
import Analysis from '../models/Analysis.model.js';
import Template from '../models/Template.model.js';
import Comment from '../models/Comment.model.js';
import { getChannel } from '../config/rabbitmq.js';
import { QUEUES } from '../constants/queues.js';
import * as auditService from '../services/audit.service.js';
import { revokeAllRefreshTokens } from '../services/auth.service.js';
import { emitAdminUserDeactivated, emitAdminStatsUpdated } from '../services/socketEmitter.service.js';
import { sendSuccess, sendError, buildPaginationMeta } from '../utils/apiResponse.js';

/** GET /admin/stats — platform-wide usage statistics */
export async function getStats(req, res) {
    // Run all count queries in parallel for speed
    const [totalUsers, totalOrgs, totalContracts, totalAnalyses] = await Promise.all([
        User.countDocuments(),
        Organization.countDocuments(),
        Contract.countDocuments({ isDeleted: false }),  // Exclude soft-deleted contracts
        Analysis.countDocuments(),
    ]);

    // Last 30 days activity — useful for growth tracking
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const analysesLast30Days = await Analysis.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    // Average risk score across all completed analyses
    const riskAgg = await Analysis.aggregate([
        { $match: { status: 'completed', riskScore: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$riskScore' } } },
    ]);
    const averageRiskScore = riskAgg[0]?.avg ? Math.round(riskAgg[0].avg * 10) / 10 : 0;

    // Check how many jobs are waiting in the RabbitMQ queue
    let queueDepth = 0;
    try {
        const channel = getChannel();
        if (channel) {
            const queueInfo = await channel.checkQueue(QUEUES.ANALYSIS);
            queueDepth = queueInfo.messageCount;
        }
    } catch { /* queue might not exist yet on first startup */ }

    const stats = { totalUsers, totalOrgs, totalContracts, totalAnalyses, analysesLast30Days, averageRiskScore, queueDepth };

    // Push live stats to all connected admins
    emitAdminStatsUpdated(stats);

    sendSuccess(res, { data: { stats } });
}

/** GET /admin/queue/status — RabbitMQ queue health check */
export async function getQueueStatus(req, res) {
    let analysisQueue = { messageCount: 0, consumerCount: 0 };
    let dlxQueue = { messageCount: 0 };

    try {
        const channel = getChannel();
        if (channel) {
            analysisQueue = await channel.checkQueue(QUEUES.ANALYSIS);
            // DLQ (dead letter queue) holds jobs that failed all retries
            try { dlxQueue = await channel.checkQueue(QUEUES.DLQ_ANALYSIS); } catch { /* DLQ might not exist */ }
        }
    } catch { /* RabbitMQ might be disconnected */ }

    sendSuccess(res, {
        data: {
            queue: {
                name: QUEUES.ANALYSIS,
                messageCount: analysisQueue.messageCount,
                consumerCount: analysisQueue.consumerCount,
                dlxMessageCount: dlxQueue.messageCount,  // Jobs that failed all retries
            },
        },
    });
}

/** GET /admin/users — paginated list of all users */
export async function listUsers(req, res) {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
        User.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        User.countDocuments(),
    ]);

    sendSuccess(res, {
        data: { users, meta: buildPaginationMeta(total, parseInt(page), parseInt(limit)) },
    });
}

/** POST /admin/users — create a user directly (pre-verified, no OTP flow) */
export async function createUser(req, res) {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return sendError(res, { statusCode: 400, code: 'VALIDATION_ERROR', message: 'name, email, password, and role are required.' });
    }

    const validRoles = ['admin', 'manager', 'viewer'];
    if (!validRoles.includes(role)) {
        return sendError(res, { statusCode: 400, code: 'VALIDATION_ERROR', message: `role must be one of: ${validRoles.join(', ')}.` });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
        return sendError(res, { statusCode: 409, code: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' });
    }

    const user = await User.create({
        name,
        email: normalizedEmail,
        password,
        role,
        emailVerified: true,  // Admin-created users skip the OTP flow
        isActive: true,
    });

    sendSuccess(res, {
        statusCode: 201,
        message: 'User created successfully.',
        data: { user },
    });
}

/** PATCH /admin/users/:id — update a user's role, active status, or name */
export async function updateUser(req, res) {
    const allowedFields = ['name', 'role', 'isActive'];
    const updates = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
        return sendError(res, { statusCode: 400, code: 'VALIDATION_ERROR', message: 'No valid fields provided to update.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'User not found.' });
    }

    sendSuccess(res, { message: 'User updated successfully.', data: { user } });
}

/** DELETE /admin/users/:id — deactivate a user (soft delete) */
export async function deactivateUser(req, res) {
    // Prevent admin from deactivating themselves
    if (req.params.id === req.user.userId.toString()) {
        return sendError(res, { statusCode: 403, code: 'FORBIDDEN', message: 'You cannot deactivate your own account.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'User not found.' });
    }

    // Notify all admins that a user was deactivated
    emitAdminUserDeactivated({
        userId: user._id,
        email: user.email,
        deactivatedBy: req.user.userId,
    });

    sendSuccess(res, { message: 'User deactivated successfully.' });
}

/** GET /admin/audit-logs — paginated global audit trail */
export async function getAuditLogs(req, res) {
    const result = await auditService.getGlobalAuditLogs(req.query);
    sendSuccess(res, {
        data: { logs: result.logs, meta: buildPaginationMeta(result.total, result.page, result.limit) },
    });
}

/** DELETE /admin/contracts/:id — permanently delete any contract (platform-wide, no org scope) */
export async function deleteContract(req, res) {
    const { id } = req.params;

    const contract = await Contract.findById(id);
    if (!contract) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found.' });
    }

    await Contract.findByIdAndDelete(id);

    // Decrement the owning org's cached contract count
    await Organization.findByIdAndUpdate(contract.orgId, { $inc: { contractCount: -1 } });

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.contract.deleted',
        resourceType: 'Contract',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'Contract permanently deleted.' });
}

/** DELETE /admin/organizations/:id — delete an org and cascade-clean its data */
export async function deleteOrganization(req, res) {
    const { id } = req.params;

    const org = await Organization.findById(id);
    if (!org) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Organization not found.' });
    }

    // Cascade: soft-delete contracts, hard-delete analyses, clear user memberships — run in parallel
    await Promise.all([
        Contract.updateMany({ orgId: id }, { isDeleted: true, deletedAt: new Date() }),
        Analysis.deleteMany({ orgId: id }),
        User.updateMany({ organization: id }, { $unset: { organization: '' }, $set: { role: 'viewer' } }),
    ]);

    // Delete the org itself last (after cascade is complete)
    await Organization.findByIdAndDelete(id);

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.organization.deleted',
        resourceType: 'Organization',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'Organization deleted.' });
}

/** DELETE /admin/analyses/:id — permanently delete any analysis (platform-wide, no org scope) */
export async function deleteAnalysis(req, res) {
    const { id } = req.params;

    const analysis = await Analysis.findById(id);
    if (!analysis) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Analysis not found.' });
    }

    await Analysis.findByIdAndDelete(id);

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.analysis.deleted',
        resourceType: 'Analysis',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'Analysis permanently deleted.' });
}

/** DELETE /admin/templates/:id — soft-delete any template including global ones */
export async function deleteTemplate(req, res) {
    const { id } = req.params;

    // Only match active templates — treat already-inactive as not found
    const template = await Template.findOne({ _id: id, isActive: true });
    if (!template) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Template not found.' });
    }

    await Template.findByIdAndUpdate(id, { isActive: false });

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.template.deleted',
        resourceType: 'Template',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'Template deleted.' });
}

/** DELETE /admin/comments/:id — hard-delete any comment platform-wide (bypasses org scope) */
export async function deleteComment(req, res) {
    const { id } = req.params;

    const comment = await Comment.findOne({ _id: id, isDeleted: false });
    if (!comment) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Comment not found.' });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.comment.deleted',
        resourceType: 'Comment',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'Comment deleted.' });
}

/** DELETE /admin/users/:id/sessions — force-revoke all active sessions for a user */
export async function revokeUserSessions(req, res) {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'User not found.' });
    }

    // Reuse the existing auth service — revokes all refresh token JTIs from Redis
    await revokeAllRefreshTokens(id);

    await auditService.log({
        userId: req.user.userId,
        action: 'admin.user.sessions.revoked',
        resourceType: 'User',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, { message: 'All sessions revoked for user.' });
}
