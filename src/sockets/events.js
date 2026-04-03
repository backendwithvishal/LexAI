/**
 * Socket Event Name Constants
 * Single source of truth for all Socket.io event names.
 */

const SOCKET_EVENTS = Object.freeze({
    // Analysis lifecycle
    ANALYSIS_COMPLETE: 'analysis:complete',
    ANALYSIS_FAILED: 'analysis:failed',

    // Contract alerts
    CONTRACT_EXPIRING: 'contract:expiring',

    // User notifications
    QUOTA_WARNING: 'quota:warning',

    // ─── New Module Events ──────────────────────────────────
    NEW_NOTIFICATION: 'new_notification',
    ORDER_STATUS_UPDATED: 'order_status_updated',
    ORDER_CREATED: 'order_created',
    REVIEW_ADDED: 'review_added',

    // Room management
    JOIN_ORG: 'join:org',
});

export default SOCKET_EVENTS;
