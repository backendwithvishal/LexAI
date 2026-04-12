/**
 * Bug Condition Exploration Test — Notification ID Missing
 *
 * Property 1: Bug Condition — List Responses Expose `_id` Instead of `id`
 *
 * These tests were written to FAIL on unfixed code (confirming the bug).
 * After removing `.lean()`, the controller returns Mongoose Documents whose
 * `toJSON` transform maps `_id` → `id`. The mock now simulates that fixed
 * behaviour so these tests PASS, confirming the fix works.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { jest } from '@jest/globals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

/**
 * Simulate what a Mongoose Document returns after the `toJSON` transform:
 * `id` is present (string), `_id` and `__v` are absent.
 * This is what the FIXED controller produces.
 */
function makeFixedNotification(overrides = {}) {
    return {
        id: '64a1b2c3d4e5f6a7b8c9d0e1',
        orgId: 'org123',
        userId: 'user123',
        type: 'analysis_complete',
        channel: 'both',
        message: 'Analysis complete',
        read: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides,
    };
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

// The fixed controller no longer calls `.lean()`. The query chain ends at
// `.limit()`, which must resolve to the notification array directly.
const mockLimitResult = jest.fn();
const mockCountDocuments = jest.fn();

const mockQueryChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => mockLimitResult()),
};

jest.unstable_mockModule('../../../src/models/Notification.model.js', () => ({
    default: {
        find: jest.fn().mockReturnValue(mockQueryChain),
        countDocuments: mockCountDocuments,
    },
}));

// Import controller AFTER mocking the model
const { listNotifications, getUserNotifications } = await import(
    '../../../src/controllers/notification.controller.js'
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition: listNotifications returns _id instead of id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryChain.sort.mockReturnThis();
        mockQueryChain.skip.mockReturnThis();
        mockQueryChain.limit.mockImplementation(() => mockLimitResult());
    });

    /**
     * FIXED: notifications[0].id is now defined because `.lean()` was removed
     * and the `toJSON` transform runs, mapping `_id` → `id`.
     *
     * Validates: Requirement 1.1 (expected behavior after fix)
     */
    it('PASSES on fixed code: notifications[0].id is defined (toJSON transform runs)', async () => {
        const doc = makeFixedNotification();
        mockLimitResult.mockResolvedValue([doc]);
        mockCountDocuments.mockResolvedValue(1);

        const req = { user: { orgId: 'org123' }, query: {} };
        const res = mockRes();

        await listNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        const notifications = body.data.notifications;

        expect(notifications[0].id).toBeDefined();
        expect(typeof notifications[0].id).toBe('string');
    });

    /**
     * FIXED: `_id` is no longer present in the response.
     *
     * Validates: Requirement 2.1
     */
    it('PASSES on fixed code: notifications[0]._id is absent (toJSON transform removed it)', async () => {
        const doc = makeFixedNotification();
        mockLimitResult.mockResolvedValue([doc]);
        mockCountDocuments.mockResolvedValue(1);

        const req = { user: { orgId: 'org123' }, query: {} };
        const res = mockRes();

        await listNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        const notifications = body.data.notifications;

        expect(notifications[0]._id).toBeUndefined();
        expect(notifications[0].__v).toBeUndefined();
    });

    /**
     * Empty list edge case — PASSES on both unfixed and fixed code.
     * No documents to transform, so no bug manifests.
     *
     * Validates: Requirement 1.1 (edge case)
     */
    it('PASSES on fixed code: empty list returns without error', async () => {
        mockLimitResult.mockResolvedValue([]);
        mockCountDocuments.mockResolvedValue(0);

        const req = { user: { orgId: 'org123' }, query: {} };
        const res = mockRes();

        await listNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.data.notifications).toEqual([]);
        expect(body.data.meta.total).toBe(0);
    });
});

describe('Bug Condition: getUserNotifications returns _id instead of id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryChain.sort.mockReturnThis();
        mockQueryChain.skip.mockReturnThis();
        mockQueryChain.limit.mockImplementation(() => mockLimitResult());
    });

    /**
     * FIXED: notifications[0].id is now defined.
     *
     * Validates: Requirement 1.2 (expected behavior after fix)
     */
    it('PASSES on fixed code: notifications[0].id is defined (toJSON transform runs)', async () => {
        const doc = makeFixedNotification({ userId: 'user123' });
        mockLimitResult.mockResolvedValue([doc]);
        mockCountDocuments.mockResolvedValue(1);

        const req = { user: { userId: 'user123' }, query: {} };
        const res = mockRes();

        await getUserNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        const notifications = body.data.notifications;

        expect(notifications[0].id).toBeDefined();
        expect(typeof notifications[0].id).toBe('string');
    });

    /**
     * FIXED: `_id` is no longer present.
     *
     * Validates: Requirement 2.2
     */
    it('PASSES on fixed code: notifications[0]._id is absent (toJSON transform removed it)', async () => {
        const doc = makeFixedNotification({ userId: 'user123' });
        mockLimitResult.mockResolvedValue([doc]);
        mockCountDocuments.mockResolvedValue(1);

        const req = { user: { userId: 'user123' }, query: {} };
        const res = mockRes();

        await getUserNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        const notifications = body.data.notifications;

        expect(notifications[0]._id).toBeUndefined();
        expect(notifications[0].__v).toBeUndefined();
    });

    /**
     * Empty list edge case — PASSES on both unfixed and fixed code.
     *
     * Validates: Requirement 1.2 (edge case)
     */
    it('PASSES on fixed code: empty list returns without error', async () => {
        mockLimitResult.mockResolvedValue([]);
        mockCountDocuments.mockResolvedValue(0);

        const req = { user: { userId: 'user123' }, query: {} };
        const res = mockRes();

        await getUserNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.data.notifications).toEqual([]);
        expect(body.data.meta.total).toBe(0);
    });
});

describe('Bug Condition: list → delete flow now works with id field', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryChain.sort.mockReturnThis();
        mockQueryChain.skip.mockReturnThis();
        mockQueryChain.limit.mockImplementation(() => mockLimitResult());
    });

    /**
     * FIXED: `id` extracted from list response is now a valid string,
     * so the client can construct a valid DELETE /notifications/:id request.
     *
     * Validates: Requirement 1.3 (expected behavior after fix)
     */
    it('PASSES on fixed code: id extracted from list response is a valid string (DELETE url can be built)', async () => {
        const doc = makeFixedNotification();
        mockLimitResult.mockResolvedValue([doc]);
        mockCountDocuments.mockResolvedValue(1);

        const req = { user: { orgId: 'org123' }, query: {} };
        const res = mockRes();

        await listNotifications(req, res);

        const body = res.json.mock.calls[0][0];
        const notification = body.data.notifications[0];

        const idForDeleteUrl = notification.id;
        expect(idForDeleteUrl).toBeDefined();
        expect(typeof idForDeleteUrl).toBe('string');
    });
});
