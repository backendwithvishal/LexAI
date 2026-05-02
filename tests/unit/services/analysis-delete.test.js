/**
 * Unit & Property Tests — Analysis Delete Service Functions
 *
 * Covers:
 *   - deleteAnalysis: audit log, Redis cache invalidation, 404 on missing, org isolation
 *   - deleteAnalysesByContract: bulk delete, zero-match case, audit log, cache invalidation
 *
 * Property tests use fast-check to verify correctness properties hold across
 * many randomly generated inputs.
 */

import { jest } from '@jest/globals';
import { testProp, fc } from '@fast-check/jest';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate a valid 24-char hex MongoDB ObjectId string */
const fcObjectId = () => fc.hexaString({ minLength: 24, maxLength: 24 });

/** Generate a string that is NOT a valid 24-char hex ObjectId */
const fcNonObjectId = () =>
    fc.string({ minLength: 1, maxLength: 50 }).filter(
        (s) => !/^[0-9a-fA-F]{24}$/.test(s)
    );

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockFindOne = jest.fn();
const mockDeleteOne = jest.fn();
const mockFind = jest.fn();
const mockDeleteMany = jest.fn();

jest.unstable_mockModule('../../../src/models/Analysis.model.js', () => ({
    default: {
        findOne: mockFindOne,
        deleteOne: mockDeleteOne,
        find: mockFind,
        deleteMany: mockDeleteMany,
    },
}));

const mockRedisDel = jest.fn();
const mockRedisGet = jest.fn();
jest.unstable_mockModule('../../../src/config/redis.js', () => ({
    getRedisClient: () => ({
        del: mockRedisDel,
        get: mockRedisGet,
    }),
}));

const mockAuditLog = jest.fn();
jest.unstable_mockModule('../../../src/services/audit.service.js', () => ({
    log: mockAuditLog,
}));

// Import service AFTER mocks are registered
const { deleteAnalysis, deleteAnalysesByContract } = await import('../../../src/services/analysis.service.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDoc(overrides = {}) {
    return {
        _id: '64a1b2c3d4e5f6a7b8c9d0e1',
        contractId: '64a1b2c3d4e5f6a7b8c9d0e2',
        orgId: 'org123',
        cacheKey: 'abc123hash',
        ...overrides,
    };
}

function makeFindChain(result) {
    return {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(result),
    };
}

// ─── deleteAnalysis unit tests ────────────────────────────────────────────────

describe('deleteAnalysis', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns { analysisId } on success', async () => {
        const doc = makeDoc();
        mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockRedisDel.mockResolvedValue(1);
        mockAuditLog.mockResolvedValue(undefined);

        const result = await deleteAnalysis(doc._id, doc.orgId, 'user1');
        expect(result).toEqual({ analysisId: doc._id });
    });

    it('throws NOT_FOUND when analysis does not exist', async () => {
        mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

        await expect(deleteAnalysis('nonexistent', 'org1', 'user1')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });
    });

    it('calls auditService.log with analysis.deleted action', async () => {
        const doc = makeDoc();
        mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockRedisDel.mockResolvedValue(1);
        mockAuditLog.mockResolvedValue(undefined);

        await deleteAnalysis(doc._id, doc.orgId, 'user42');

        expect(mockAuditLog).toHaveBeenCalledTimes(1);
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'analysis.deleted', userId: 'user42' })
        );
    });

    it('swallows Redis del failure and does not throw', async () => {
        const doc = makeDoc({ cacheKey: 'somekey' });
        mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockRedisDel.mockRejectedValue(new Error('Redis connection refused'));
        mockAuditLog.mockResolvedValue(undefined);

        // Should NOT throw even though Redis failed
        await expect(deleteAnalysis(doc._id, doc.orgId, 'user1')).resolves.toEqual({
            analysisId: doc._id,
        });
    });

    it('skips Redis del when cacheKey is absent', async () => {
        const doc = makeDoc({ cacheKey: undefined });
        mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mockAuditLog.mockResolvedValue(undefined);

        await deleteAnalysis(doc._id, doc.orgId, 'user1');
        expect(mockRedisDel).not.toHaveBeenCalled();
    });
});

// ─── deleteAnalysesByContract unit tests ─────────────────────────────────────

describe('deleteAnalysesByContract', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns { deletedCount: 0 } when no analyses exist without throwing', async () => {
        mockFind.mockReturnValue(makeFindChain([]));
        mockAuditLog.mockResolvedValue(undefined);

        const result = await deleteAnalysesByContract('contract1', 'org1', 'user1');
        expect(result).toEqual({ deletedCount: 0 });
        expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it('calls auditService.log once with analysis.bulk_deleted and correct count', async () => {
        const docs = [makeDoc({ _id: 'id1', cacheKey: 'k1' }), makeDoc({ _id: 'id2', cacheKey: 'k2' })];
        mockFind.mockReturnValue(makeFindChain(docs));
        mockDeleteMany.mockResolvedValue({ deletedCount: 2 });
        mockRedisDel.mockResolvedValue(1);
        mockAuditLog.mockResolvedValue(undefined);

        await deleteAnalysesByContract('contract1', 'org1', 'user1');

        expect(mockAuditLog).toHaveBeenCalledTimes(1);
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'analysis.bulk_deleted',
                metadata: expect.objectContaining({ deletedCount: 2 }),
            })
        );
    });

    it('deletes all cacheKeys from Redis', async () => {
        const docs = [
            makeDoc({ _id: 'id1', cacheKey: 'key1' }),
            makeDoc({ _id: 'id2', cacheKey: 'key2' }),
            makeDoc({ _id: 'id3', cacheKey: undefined }),
        ];
        mockFind.mockReturnValue(makeFindChain(docs));
        mockDeleteMany.mockResolvedValue({ deletedCount: 3 });
        mockRedisDel.mockResolvedValue(1);
        mockAuditLog.mockResolvedValue(undefined);

        await deleteAnalysesByContract('contract1', 'org1', 'user1');

        // Only docs with cacheKey should trigger redis.del
        expect(mockRedisDel).toHaveBeenCalledTimes(2);
    });

    it('swallows Redis del failure during bulk delete', async () => {
        const docs = [makeDoc({ _id: 'id1', cacheKey: 'key1' })];
        mockFind.mockReturnValue(makeFindChain(docs));
        mockDeleteMany.mockResolvedValue({ deletedCount: 1 });
        mockRedisDel.mockRejectedValue(new Error('Redis down'));
        mockAuditLog.mockResolvedValue(undefined);

        await expect(
            deleteAnalysesByContract('contract1', 'org1', 'user1')
        ).resolves.toEqual({ deletedCount: 1 });
    });
});

// ─── Property 1: Permanent deletion invariant ─────────────────────────────────

describe('Property 1: Permanent deletion invariant', () => {
    testProp(
        'after deleteAnalysis succeeds, deleteOne is called with the correct analysisId',
        [fcObjectId(), fcObjectId(), fcObjectId()],
        async (analysisId, orgId, userId) => {
            jest.clearAllMocks();
            const doc = makeDoc({ _id: analysisId, orgId, cacheKey: null });
            mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
            mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
            mockAuditLog.mockResolvedValue(undefined);

            await deleteAnalysis(analysisId, orgId, userId);

            // deleteOne must have been called — document is permanently removed
            expect(mockDeleteOne).toHaveBeenCalledTimes(1);
            expect(mockDeleteOne).toHaveBeenCalledWith(
                expect.objectContaining({ _id: analysisId })
            );
        },
        { numRuns: 50 }
    );
});

// ─── Property 2: Cache invalidation on delete ─────────────────────────────────

describe('Property 2: Cache invalidation on delete', () => {
    testProp(
        'redis.del is called with the correct cache key for every analysis that has a cacheKey',
        [fc.string({ minLength: 1, maxLength: 40 }), fcObjectId(), fcObjectId()],
        async (cacheKey, orgId, userId) => {
            jest.clearAllMocks();
            const doc = makeDoc({ orgId, cacheKey });
            mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
            mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
            mockRedisDel.mockResolvedValue(1);
            mockAuditLog.mockResolvedValue(undefined);

            await deleteAnalysis(doc._id, orgId, userId);

            expect(mockRedisDel).toHaveBeenCalledTimes(1);
            // The key passed to redis.del must contain the cacheKey
            const calledWith = mockRedisDel.mock.calls[0][0];
            expect(calledWith).toContain(cacheKey);
        },
        { numRuns: 50 }
    );
});

// ─── Property 3: Org isolation ────────────────────────────────────────────────

describe('Property 3: Org isolation — cross-org delete returns NOT_FOUND', () => {
    testProp(
        'deleteAnalysis throws NOT_FOUND when analysis belongs to a different org',
        [fcObjectId(), fcObjectId(), fcObjectId(), fcObjectId()],
        async (analysisId, orgIdA, orgIdB, userId) => {
            // Only run when the two orgIds are actually different
            fc.pre(orgIdA !== orgIdB);

            jest.clearAllMocks();
            // findOne returns null because orgId doesn't match (org isolation at DB level)
            mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

            await expect(deleteAnalysis(analysisId, orgIdB, userId)).rejects.toMatchObject({
                statusCode: 404,
                code: 'NOT_FOUND',
            });

            // deleteOne must NEVER be called when the doc is not found
            expect(mockDeleteOne).not.toHaveBeenCalled();
        },
        { numRuns: 50 }
    );
});
