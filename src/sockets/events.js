/**
 * Socket Event Name Constants
 * Single source of truth for all Socket.io event names.
 *
 * Room targeting guide:
 *   user:<userId>  — personal events (analysis done, quota warning, etc.)
 *   org:<orgId>    — org-wide events (contract uploaded, member changes, etc.)
 *   admin          — platform-wide events (admin stats, system alerts)
 */

const SOCKET_EVENTS = Object.freeze({
    // ─── Analysis lifecycle ─────────────────────────────────
    // Room: user:<userId>
    ANALYSIS_COMPLETE: 'analysis:complete',
    ANALYSIS_FAILED:   'analysis:failed',

    // ─── Contract version diff ──────────────────────────────
    // Room: user:<userId>  (diff was requested by a specific user)
    DIFF_COMPLETE: 'diff:complete',
    DIFF_FAILED:   'diff:failed',

    // ─── Contract lifecycle (org-wide) ──────────────────────
    // Room: org:<orgId>
    CONTRACT_UPLOADED: 'contract:uploaded',
    CONTRACT_UPDATED:  'contract:updated',
    CONTRACT_DELETED:  'contract:deleted',
    CONTRACT_EXPIRING: 'contract:expiring',

    // ─── Comments (org-wide collaboration) ──────────────────
    // Room: org:<orgId>
    COMMENT_CREATED: 'comment:created',
    COMMENT_UPDATED: 'comment:updated',
    COMMENT_DELETED: 'comment:deleted',

    // ─── Org membership ─────────────────────────────────────
    // Room: org:<orgId>
    MEMBER_INVITED: 'member:invited',
    MEMBER_JOINED:  'member:joined',
    MEMBER_REMOVED: 'member:removed',
    MEMBER_ROLE_CHANGED: 'member:role_changed',

    // ─── Bulk operations ────────────────────────────────────
    // Room: user:<userId>  (the user who triggered the bulk op)
    BULK_COMPLETE: 'bulk:complete',
    BULK_FAILED:   'bulk:failed',

    // ─── Quota / plan limits ────────────────────────────────
    // Room: user:<userId>
    QUOTA_WARNING: 'quota:warning',

    // ─── Notifications ──────────────────────────────────────
    // Room: user:<userId>
    NEW_NOTIFICATION: 'new_notification',

    // ─── Admin platform events ──────────────────────────────
    // Room: admin
    ADMIN_STATS_UPDATED: 'admin:stats_updated',
    ADMIN_USER_DEACTIVATED: 'admin:user_deactivated',

    // ─── Room management (client → server) ──────────────────
    JOIN_ORG: 'join:org',
});

export default SOCKET_EVENTS;
