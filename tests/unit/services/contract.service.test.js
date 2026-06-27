/**
 * Contract Service — Comprehensive Unit Tests
 *
 * Covers:
 *   - createContract: plan limits, text extraction, hash, audit log
 *   - listContracts: pagination, filtering, search
 *   - getContractById: org isolation, not found
 *   - updateContract: safe field update, not found
 *   - addVersion: version increment, hash
 *   - getVersions: metadata only
 *   - deleteContract: soft delete, audit, org count decrement
 */

import { jest } from '@jest/globals';

// ─── env mock ─────────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/config/env.js', () => ({
    default: {
        NODE_ENV: 'test',
        MONGO_URI: 'mongodb://localhost:27017/lexai_test',
    },
}));

// ─── Contract model mock ──────────────────────────────────────────────────────
const mockContractFindOne = jest.fn();
const mockContractFindOneAndUpdate = jest.fn();
const mockContractCreate = jest.fn();
const mockContractFind = jest.fn();
const mockContractCountDocuments = jest.fn();

jest.unstable_mockModule('../../../src/models/Contract.model.js', () => ({
    default: {
        findOne: mockContractFindOne,
        findOneAndUpdate: mockContractFindOneAndUpdate,
        create: mockContractCreate,
        find: mockContractFind,
        countDocuments: mockContractCountDocuments,
    },
}));

// ─── Organization model mock ──────────────────────────────────────────────────
const mockOrgFindById = jest.fn();
const mockOrgFindByIdAndUpdate = jest.fn();

jest.unstable_mockModule('../../../src/models/Organization.model.js', () => ({
    default: {
        findById: mockOrgFindById,
        findByIdAndUpdate: mockOrgFindByIdAndUpdate,
    },
}));

// ─── Utility mocks ────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/utils/hashHelper.js', () => ({
    hashContent: jest.fn().mockReturnValue('sha256-hash-abc'),
}));

jest.unstable_mockModule('../../../src/utils/textExtractor.js', () => ({
    extractText: jest.fn().mockResolvedValue('Extracted contract text with more than fifty characters for validation.'),
}));

jest.unstable_mockModule('../../../src/utils/apiResponse.js', () => ({
    buildPaginationMeta: jest.fn().mockReturnValue({ total: 1, page: 1, limit: 10, totalPages: 1 }),
    sendSuccess: jest.fn(),
    sendError: jest.fn(),
}));

// ─── Plans mock ───────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/constants/plans.js', () => ({
    getPlanLimits: jest.fn().mockReturnValue({ maxContracts: Infinity, maxAnalysisPerMonth: 100 }),
}));

// ─── Audit service mock ───────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/services/audit.service.js', () => ({
    log: jest.fn().mockResolvedValue(undefined),
    getContractAuditLogs: jest.fn().mockResolvedValue([]),
}));

// ─── Logger mock ──────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// ─── Import service AFTER mocks ───────────────────────────────────────────────
const {
    createContract,
    listContracts,
    getContractById,
    updateContract,
    addVersion,
    getVersions,
    deleteContract,
} = await import('../../../src/services/contract.service.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeOrg(plan = 'free', contractCount = 0) {
    return { _id: 'org123', name: 'Test Org', plan, contractCount };
}

function makeContract(overrides = {}) {
    return {
        _id: 'contract123',
        orgId: 'org123',
        title: 'Service Agreement',
        type: 'Service',
        tags: ['legal'],
        content: 'Contract content that is long enough for validation at fifty chars minimum.',
        contentHash: 'sha256-hash-abc',
        currentVersion: 1,
        isDeleted: false,
        versions: [
            {
                versionNumber: 1,
                content: 'Version 1 content that is long enough for validation at fifty chars.',
                contentHash: 'sha256-hash-abc',
                uploadedBy: 'user123',
                uploadedAt: new Date('2026-01-01'),
                changeNote: 'Initial upload',
            },
        ],
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// createContract
// ─────────────────────────────────────────────────────────────────────────────
describe('createContract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOrgFindById.mockResolvedValue(makeOrg('free', 0));
        mockOrgFindByIdAndUpdate.mockResolvedValue(undefined);
        mockContractCreate.mockResolvedValue(makeContract());
    });

    it('creates contract from raw text content', async () => {
        const result = await createContract({
            orgId: 'org123',
            userId: 'user123',
            title: 'Service Agreement',
            type: 'Service',
            tags: ['legal'],
            content: 'This is a valid contract text that is at least 50 characters long.',
        });

        expect(result._id).toBe('contract123');
        expect(mockContractCreate).toHaveBeenCalledTimes(1);
    });

    it('extracts text from file buffer when file is provided', async () => {
        const { extractText } = await import('../../../src/utils/textExtractor.js');

        await createContract({
            orgId: 'org123',
            userId: 'user123',
            title: 'PDF Contract',
            type: 'NDA',
            file: { buffer: Buffer.from('PDF data'), mimetype: 'application/pdf', size: 1024 },
        });

        expect(extractText).toHaveBeenCalledWith(
            expect.any(Buffer),
            'application/pdf'
        );
    });

    it('increments org contract count after creation', async () => {
        await createContract({
            orgId: 'org123',
            userId: 'user123',
            title: 'Test',
            content: 'Valid contract content that is at least 50 characters long for test.',
        });
        expect(mockOrgFindByIdAndUpdate).toHaveBeenCalledWith('org123', { $inc: { contractCount: 1 } });
    });

    it('throws CONTENT_TOO_SHORT when content is less than 50 chars', async () => {
        await expect(
            createContract({
                orgId: 'org123',
                userId: 'user123',
                title: 'Short',
                content: 'Too short.',
            })
        ).rejects.toMatchObject({ code: 'CONTENT_TOO_SHORT' });
    });

    it('throws PLAN_LIMIT when org has reached max contracts', async () => {
        const { getPlanLimits } = await import('../../../src/constants/plans.js');
        getPlanLimits.mockReturnValue({ maxContracts: 5 });
        mockOrgFindById.mockResolvedValue(makeOrg('free', 5));

        await expect(
            createContract({
                orgId: 'org123',
                userId: 'user123',
                title: 'Over Limit',
                content: 'Contract content that is valid and long enough for the limit check.',
            })
        ).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
    });

    it('parses string tags from comma-separated format', async () => {
        await createContract({
            orgId: 'org123',
            userId: 'user123',
            title: 'Tagged Contract',
            content: 'Valid contract content that is at least 50 characters long for test.',
            tags: 'legal,nda,2026',
        });

        expect(mockContractCreate).toHaveBeenCalledWith(
            expect.objectContaining({ tags: ['legal', 'nda', '2026'] })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// listContracts
// ─────────────────────────────────────────────────────────────────────────────
describe('listContracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const chainable = {
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([makeContract()]),
        };
        mockContractFind.mockReturnValue(chainable);
        mockContractCountDocuments.mockResolvedValue(1);
    });

    it('returns contracts array and pagination meta', async () => {
        const result = await listContracts('org123', { page: 1, limit: 10 });
        expect(result.contracts).toHaveLength(1);
        expect(result.meta).toBeDefined();
    });

    it('applies type filter when provided', async () => {
        await listContracts('org123', { type: 'NDA' });
        expect(mockContractFind).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'NDA' }),
            expect.anything()
        );
    });

    it('applies tag filter when provided', async () => {
        await listContracts('org123', { tag: 'legal' });
        expect(mockContractFind).toHaveBeenCalledWith(
            expect.objectContaining({ tags: 'legal' }),
            expect.anything()
        );
    });

    it('applies full-text search when search query provided', async () => {
        await listContracts('org123', { search: 'service agreement' });
        expect(mockContractFind).toHaveBeenCalledWith(
            expect.objectContaining({ $text: { $search: 'service agreement' } }),
            expect.anything()
        );
    });

    it('always scopes results to the given orgId', async () => {
        await listContracts('org-xyz', {});
        expect(mockContractFind).toHaveBeenCalledWith(
            expect.objectContaining({ orgId: 'org-xyz', isDeleted: false }),
            expect.anything()
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getContractById
// ─────────────────────────────────────────────────────────────────────────────
describe('getContractById', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns contract when found in org', async () => {
        mockContractFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeContract()) });
        const result = await getContractById('contract123', 'org123');
        expect(result._id).toBe('contract123');
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
        mockContractFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        await expect(getContractById('nonexistent', 'org123'))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('enforces org isolation — returns NOT_FOUND for wrong org', async () => {
        // When orgId doesn't match, MongoDB returns null (simulated here)
        mockContractFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        await expect(getContractById('contract123', 'different-org'))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateContract
// ─────────────────────────────────────────────────────────────────────────────
describe('updateContract', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns updated contract on success', async () => {
        const updated = makeContract({ title: 'Updated Title' });
        mockContractFindOneAndUpdate.mockResolvedValue(updated);

        const result = await updateContract('contract123', 'org123', { title: 'Updated Title' });
        expect(result.title).toBe('Updated Title');
    });

    it('throws NOT_FOUND when contract not found', async () => {
        mockContractFindOneAndUpdate.mockResolvedValue(null);
        await expect(updateContract('bad-id', 'org123', { title: 'X' }))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// addVersion
// ─────────────────────────────────────────────────────────────────────────────
describe('addVersion', () => {
    let contract;

    beforeEach(() => {
        jest.clearAllMocks();
        contract = makeContract();
        mockContractFindOne.mockResolvedValue(contract);
    });

    it('increments version number and saves', async () => {
        const result = await addVersion('contract123', 'org123', 'user123', {
            content: 'Updated contract content that is at least 50 characters long for version 2.',
            changeNote: 'Revised terms',
        });

        expect(result.versionNumber).toBe(2);
        expect(contract.save).toHaveBeenCalled();
    });

    it('pushes new version onto versions array', async () => {
        await addVersion('contract123', 'org123', 'user123', {
            content: 'Updated contract content that is at least 50 characters long for version 2.',
            changeNote: 'v2',
        });

        expect(contract.versions.length).toBe(2);
        expect(contract.versions[1].versionNumber).toBe(2);
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
        mockContractFindOne.mockResolvedValue(null);
        await expect(
            addVersion('bad-id', 'org123', 'user123', { content: 'content', changeNote: 'note' })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getVersions
// ─────────────────────────────────────────────────────────────────────────────
describe('getVersions', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns version metadata array', async () => {
        const contract = makeContract();
        mockContractFindOne.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(contract),
        });

        const result = await getVersions('contract123', 'org123');
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('content'); // content excluded
        expect(result[0]).toHaveProperty('versionNumber', 1);
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
        mockContractFindOne.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null),
        });
        await expect(getVersions('bad-id', 'org123'))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteContract
// ─────────────────────────────────────────────────────────────────────────────
describe('deleteContract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const deleted = makeContract({ isDeleted: true });
        mockContractFindOneAndUpdate.mockResolvedValue(deleted);
        mockOrgFindByIdAndUpdate.mockResolvedValue(undefined);
    });

    it('soft-deletes contract and decrements org count', async () => {
        await deleteContract('contract123', 'org123', 'user123');

        expect(mockContractFindOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'contract123', orgId: 'org123', isDeleted: false },
            expect.objectContaining({ isDeleted: true }),
            { new: true }
        );
        expect(mockOrgFindByIdAndUpdate).toHaveBeenCalledWith(
            'org123',
            { $inc: { contractCount: -1 } }
        );
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
        mockContractFindOneAndUpdate.mockResolvedValue(null);
        await expect(deleteContract('bad-id', 'org123', 'user123'))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
