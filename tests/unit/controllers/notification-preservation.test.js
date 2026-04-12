/**
 * Preservation Property Tests — Notification Non-List Endpoints
 *
 * Property 2: Preservation — Non-List Endpoint Behavior Is Unchanged
 *
 * These tests MUST PASS on unfixed code. They establish the baseline behavior
 * of endpoints that do NOT use `.lean()` and verify pagination metadata is
 * arithmetically consistent.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { jest } from '@jest/globals';
import { testProp, fc } from '@fast-check/jest';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

/**
 * A serialized notification object as it appears in the response body after
 * the Mongoose toJSON transform has run (no .lean() — _id → id, __v removed).
 * This simulates what Express's res.json() produces when serializing a
 * Mongoose Document returned by findOneAndUpdate / findOneAndDelete.
 */
function makeDocumentNotification(overrides = {}) {
    // Simulate the result after toJSON transform: id present, _id and __v absent
    return {
        id: '64a1b2c3d4e5f6a7b8c9d0e1',
        orgId: 'org123',
        userId: 'user123',
        type: 'analysis_complete',
        channel: 'both',
        message: 'Analysis complete',
        read: true,
        readAt: new Date('2024-01-02'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        ...overrides,
    };
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockFindOneAndUpdate = jest.fn();
const mockFindOneAndDelete = jest.fn();
const mockCountDocuments = jest.fn();
const mockUpdateMany = jest.fn();
const mockLeanResult = jest.fn();

const mockQueryChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockImplementation(() => mockLeanResult()),
};

jest.unstable_mockModule('../../../src/models/Notification.model.js', () => ({
    default: {
        find: jest.fn().mockReturnValue(mockQueryChain),
        findOneAndUpdate: mockFindOneAndUpdate,
        findOneAndDelete: mockFindOneAndDelete,
        countDocuments: mockCountDocuments,
        updateMany: mockUpdateMany,
    },
}));

// Import controllers AFTER mocking the model
const {
    markAsRead,
    deleteNotification,
    getUnreadCount,
    markAllAsRead,
    listNotifications,
} = await import('../../../src/controllers/notification.controller.js');

// ─── markAsRead Preservation ──────────────────────────────────────────────────

describe('Preservation: markAsRead response shape', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * markAsRead uses findOneAndUpdate without .lean(), so the toJSON transform
     * runs and `id` is present. Verify the response shape is correct.
     *
     * Validates: Requirement 3.1
     */
    it('returns notification with id present and read: true', async () => {
        const doc = makeDocumentNotification({ read: true });
        mockFindOneAndUpdate.mockResolvedValue(doc);

        const req = { user: { userId: 'user123' }, params: { id: '64a1b2c3d4e5f6a7b8c9d0e1' } };
        const res = mockRes();

        await markAsRead(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);

        const notification = body.data.notification;
        // id must be present (toJSON transform ran — no .lean())
        expect(notification.id).toBeDefined();
        expect(notification.read).toBe(true);
    });

    it('returns 404 when notification not found', async () => {
        mockFindOneAndUpdate.mockResolvedValue(null);

        const req = { user: { userId: 'user123' }, params: { id: 'nonexistent' } };
        const res = mockRes();

        await markAsRead(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
    });
});

// ─── deleteNotification Preservation ─────────────────────────────────────────

describe('Preservation: deleteNotification response shape', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * deleteNotification uses findOneAndDelete without .lean().
     * Verify the success message is exactly "Notification deleted."
     *
     * Validates: Requirement 3.4
     */
    it('returns success message "Notification deleted."', async () => {
        const doc = makeDocumentNotification();
        mockFindOneAndDelete.mockResolvedValue(doc);

        const req = { user: { userId: 'user123' }, params: { id: '64a1b2c3d4e5f6a7b8c9d0e1' } };
        const res = mockRes();

        await deleteNotification(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.message).toBe('Notification deleted.');
    });

    it('returns 404 when notification not found', async () => {
        mockFindOneAndDelete.mockResolvedValue(null);

        const req = { user: { userId: 'user123' }, params: { id: 'nonexistent' } };
        const res = mockRes();

        await deleteNotification(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
    });
});

// ─── getUnreadCount Preservation ─────────────────────────────────────────────

describe('Preservation: getUnreadCount response shape', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * getUnreadCount returns { unreadCount: N }.
     * Verify the shape is correct for various counts.
     *
     * Validates: Requirement 3.3
     */
    it('returns { unreadCount: N } shape', async () => {
        mockCountDocuments.mockResolvedValue(5);

        const req = { user: { orgId: 'org123' } };
        const res = mockRes();

        await getUnreadCount(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('unreadCount', 5);
    });

    it('returns { unreadCount: 0 } when no unread notifications', async () => {
        mockCountDocuments.mockResolvedValue(0);

        const req = { user: { orgId: 'org123' } };
        const res = mockRes();

        await getUnreadCount(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.data.unreadCount).toBe(0);
    });
});

// ─── markAllAsRead Preservation ───────────────────────────────────────────────

describe('Preservation: markAllAsRead response shape', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * markAllAsRead returns { modifiedCount: N }.
     * Verify the shape is correct.
     *
     * Validates: Requirement 3.2
     */
    it('returns { modifiedCount: N } shape', async () => {
        mockUpdateMany.mockResolvedValue({ modifiedCount: 3 });

        const req = { user: { orgId: 'org123' } };
        const res = mockRes();

        await markAllAsRead(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('modifiedCount', 3);
    });

    it('returns { modifiedCount: 0 } when nothing to mark', async () => {
        mockUpdateMany.mockResolvedValue({ modifiedCount: 0 });

        const req = { user: { orgId: 'org123' } };
        const res = mockRes();

        await markAllAsRead(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.data.modifiedCount).toBe(0);
    });
});

// ─── Pagination Metadata Property-Based Test ──────────────────────────────────

describe('Preservation: pagination metadata arithmetic consistency', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryChain.sort.mockReturnThis();
        mockQueryChain.skip.mockReturnThis();
        mockQueryChain.limit.mockReturnThis();
        mockLeanResult.mockResolvedValue([]);
    });

    /**
     * Property 2: Preservation — Pagination Metadata Is Arithmetically Consistent
     *
     * For any (page, limit) combination and any seeded document count, the
     * returned meta fields must satisfy:
     *   - meta.total === seededCount
     *   - meta.page === requested page
     *   - meta.limit === requested limit
     *   - meta.totalPages === Math.ceil(total / limit)
     *
     * Validates: Requirement 3.5
     */
    testProp(
        'pagination meta fields are arithmetically consistent with seeded document count',
        [
            fc.integer({ min: 1, max: 10 }),   // page
            fc.integer({ min: 1, max: 100 }),  // limit
            fc.integer({ min: 0, max: 500 }),  // total documents seeded
        ],
        async (page, limit, seededCount) => {
            jest.clearAllMocks();
            mockQueryChain.sort.mockReturnThis();
            mockQueryChain.skip.mockReturnThis();
            mockQueryChain.limit.mockReturnThis();
            mockLeanResult.mockResolvedValue([]);
            mockCountDocuments.mockResolvedValue(seededCount);

            const req = {
                user: { orgId: 'org123' },
                query: { page: String(page), limit: String(limit) },
            };
            const res = mockRes();

            await listNotifications(req, res);

            const body = res.json.mock.calls[0][0];
            const meta = body.data.meta;

            // meta.total must equal the seeded document count
            expect(meta.total).toBe(seededCount);

            // meta.page must equal the requested page
            expect(meta.page).toBe(page);

            // meta.limit must equal the requested limit
            expect(meta.limit).toBe(limit);

            // meta.totalPages must be Math.ceil(total / limit)
            const expectedTotalPages = Math.ceil(seededCount / limit);
            expect(meta.totalPages).toBe(expectedTotalPages);
        },
        { numRuns: 50 }
    );
});
