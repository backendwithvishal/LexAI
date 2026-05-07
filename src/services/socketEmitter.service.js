/**
 * Socket Emitter Service
 *
 * Dedicated service for emitting Socket.IO events.
 * Keeps socket logic OUT of controllers — controllers never touch io directly.
 *
 * Room targeting:
 *   user:<userId>  — personal events (analysis, diff, quota, notifications)
 *   org:<orgId>    — org-wide events (contracts, comments, membership)
 *   admin          — platform-wide admin events
 *
 * Uses getIO() from src/config/socket.js.
 * Called by workers and services after completing async operations.
 */

import { getIO } from '../config/socket.js';
import SOCKET_EVENTS from '../sockets/events.js';
import logger from '../utils/logger.js';

// ─── Internal helper ────────────────────────────────────────────────────────

/**
 * Emit an event to a room, swallowing errors so a socket failure
 * never crashes the calling service.
 *
 * @param {string} room  - Socket.io room name
 * @param {string} event - Event name from SOCKET_EVENTS
 * @param {object} data  - Event payload
 */
function emit(room, event, data) {
    try {
        const io = getIO();
        io.to(room).emit(event, data);
        logger.debug(`Socket emitted: ${event} → ${room}`);
    } catch (err) {
        logger.error(`Failed to emit ${event} to ${room}:`, err.message);
    }
}

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Notify a user that their analysis job completed.
 * @param {string} userId
 * @param {object} data - { analysisId, contractId, status, riskScore, ... }
 */
export function emitAnalysisComplete(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.ANALYSIS_COMPLETE, data);
}

/**
 * Notify a user that their analysis job failed.
 * @param {string} userId
 * @param {object} data - { analysisId, contractId, error }
 */
export function emitAnalysisFailed(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.ANALYSIS_FAILED, data);
}

// ─── Diff ────────────────────────────────────────────────────────────────────

/**
 * Notify a user that their version diff + AI explanation is ready.
 * @param {string} userId
 * @param {object} data - { contractId, versionA, versionB, diffId, summary }
 */
export function emitDiffComplete(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.DIFF_COMPLETE, data);
}

/**
 * Notify a user that their diff job failed.
 * @param {string} userId
 * @param {object} data - { contractId, versionA, versionB, error }
 */
export function emitDiffFailed(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.DIFF_FAILED, data);
}

// ─── Contracts ───────────────────────────────────────────────────────────────

/**
 * Broadcast to an org that a new contract was uploaded.
 * @param {string} orgId
 * @param {object} data - { contractId, title, type, uploadedBy }
 */
export function emitContractUploaded(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.CONTRACT_UPLOADED, data);
}

/**
 * Broadcast to an org that a contract was updated (metadata or new version).
 * @param {string} orgId
 * @param {object} data - { contractId, title, updatedBy, changes }
 */
export function emitContractUpdated(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.CONTRACT_UPDATED, data);
}

/**
 * Broadcast to an org that a contract was deleted.
 * @param {string} orgId
 * @param {object} data - { contractId, title, deletedBy }
 */
export function emitContractDeleted(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.CONTRACT_DELETED, data);
}

/**
 * Broadcast to an org that a contract is expiring soon.
 * @param {string} orgId
 * @param {object} data - { contractId, title, expiresAt, daysRemaining }
 */
export function emitContractExpiring(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.CONTRACT_EXPIRING, data);
}

// ─── Comments ────────────────────────────────────────────────────────────────

/**
 * Broadcast to an org that a comment was added to a contract.
 * @param {string} orgId
 * @param {object} data - { commentId, contractId, userId, content, createdAt }
 */
export function emitCommentCreated(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.COMMENT_CREATED, data);
}

/**
 * Broadcast to an org that a comment was edited.
 * @param {string} orgId
 * @param {object} data - { commentId, contractId, userId, content, updatedAt }
 */
export function emitCommentUpdated(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.COMMENT_UPDATED, data);
}

/**
 * Broadcast to an org that a comment was deleted.
 * @param {string} orgId
 * @param {object} data - { commentId, contractId, deletedBy }
 */
export function emitCommentDeleted(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.COMMENT_DELETED, data);
}

// ─── Org membership ──────────────────────────────────────────────────────────

/**
 * Broadcast to an org that a new member was invited.
 * @param {string} orgId
 * @param {object} data - { email, role, invitedBy, invitationId }
 */
export function emitMemberInvited(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.MEMBER_INVITED, data);
}

/**
 * Broadcast to an org that an invited member accepted and joined.
 * @param {string} orgId
 * @param {object} data - { userId, name, email, role }
 */
export function emitMemberJoined(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.MEMBER_JOINED, data);
}

/**
 * Broadcast to an org that a member was removed.
 * @param {string} orgId
 * @param {object} data - { userId, removedBy }
 */
export function emitMemberRemoved(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.MEMBER_REMOVED, data);
}

/**
 * Broadcast to an org that a member's role was changed.
 * @param {string} orgId
 * @param {object} data - { userId, oldRole, newRole, changedBy }
 */
export function emitMemberRoleChanged(orgId, data) {
    emit(`org:${orgId}`, SOCKET_EVENTS.MEMBER_ROLE_CHANGED, data);
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

/**
 * Notify a user that their bulk operation completed.
 * @param {string} userId
 * @param {object} data - { operation, modifiedCount, contractIds }
 */
export function emitBulkComplete(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.BULK_COMPLETE, data);
}

/**
 * Notify a user that their bulk operation failed.
 * @param {string} userId
 * @param {object} data - { operation, error }
 */
export function emitBulkFailed(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.BULK_FAILED, data);
}

// ─── Quota ───────────────────────────────────────────────────────────────────

/**
 * Warn a user that they are approaching their plan quota.
 * @param {string} userId
 * @param {object} data - { used, limit, percentage, resourceType }
 */
export function emitQuotaWarning(userId, data) {
    emit(`user:${userId}`, SOCKET_EVENTS.QUOTA_WARNING, data);
}

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * Emit a new notification event to a specific user's room.
 * @param {string} userId
 * @param {object} notification - Notification document
 */
export function emitNewNotification(userId, notification) {
    emit(`user:${userId}`, SOCKET_EVENTS.NEW_NOTIFICATION, notification);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * Push updated platform stats to all connected admins.
 * @param {object} data - { totalUsers, totalOrgs, totalContracts, queueDepth, ... }
 */
export function emitAdminStatsUpdated(data) {
    emit('admin', SOCKET_EVENTS.ADMIN_STATS_UPDATED, data);
}

/**
 * Notify admins that a user was deactivated.
 * @param {object} data - { userId, email, deactivatedBy }
 */
export function emitAdminUserDeactivated(data) {
    emit('admin', SOCKET_EVENTS.ADMIN_USER_DEACTIVATED, data);
}

// ─── Generic helper ──────────────────────────────────────────────────────────

/**
 * Emit any event to any room — escape hatch for one-off cases.
 * Prefer the typed emitters above for all standard events.
 *
 * @param {string} room  - Room name (e.g., 'user:abc123', 'org:xyz', 'admin')
 * @param {string} event - Socket.IO event name
 * @param {object} data  - Event payload
 */
export function emitToRoom(room, event, data) {
    emit(room, event, data);
}
