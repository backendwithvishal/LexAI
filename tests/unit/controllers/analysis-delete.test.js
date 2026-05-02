/**
 * Unit Tests — Analysis Delete Controller Handlers
 *
 * Tests the thin HTTP layer for deleteAnalysis and deleteAnalysesByContract.
 * The service is fully mocked — only controller response shape is verified.
 *
 * Validates: Requirements 1.1, 2.1
 */

import { jest } from '@jest/globals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockDeleteAnalysis = jest.fn();
const mockDeleteAnalysesByContract = jest.fn();

jest.unstable_mockModule('../../../src/services/analysis.service.js', () => ({
    requestAnalysis: jest.fn(),
    getAnalysis: jest.fn(),
    getAnalysesByContract: jest.fn(),
    deleteAnalysis: mockDeleteAnalysis,
    deleteAnalysesByContract: mockDeleteAnalysesByContract,
}));

// Import controller AFTER mocks are registered
const {
    deleteAnalysis,
    deleteAnalysesByContract,
} = await import('../../../src/controllers/analysis.controller.js');

// ─── deleteAnalysis controller ────────────────────────────────────────────────

describe('deleteAnalysis controller', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 with correct shape on success', async () => {
        const analysisId = '64a1b2c3d4e5f6a7b8c9d0e1';
        mockDeleteAnalysis.mockResolvedValue({ analysisId });

        const req = {
            orgId: 'org123',
            user: { userId: 'user1' },
            params: { id: analysisId },
        };
        const res = mockRes();

        await deleteAnalysis(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.message).toBe('Analysis deleted.');
        expect(body.data).toEqual({ analysisId });
    });

    it('passes correct args to the service', async () => {
        const analysisId = '64a1b2c3d4e5f6a7b8c9d0e1';
        mockDeleteAnalysis.mockResolvedValue({ analysisId });

        const req = {
            orgId: 'org123',
            user: { userId: 'user42' },
            params: { id: analysisId },
        };
        const res = mockRes();

        await deleteAnalysis(req, res);

        expect(mockDeleteAnalysis).toHaveBeenCalledWith(analysisId, 'org123', 'user42');
    });
});

// ─── deleteAnalysesByContract controller ─────────────────────────────────────

describe('deleteAnalysesByContract controller', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 with deletedCount on success', async () => {
        mockDeleteAnalysesByContract.mockResolvedValue({ deletedCount: 3 });

        const req = {
            orgId: 'org123',
            user: { userId: 'user1' },
            params: { contractId: '64a1b2c3d4e5f6a7b8c9d0e2' },
        };
        const res = mockRes();

        await deleteAnalysesByContract(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.data).toEqual({ deletedCount: 3 });
    });

    it('uses singular "analysis" in message when deletedCount is 1', async () => {
        mockDeleteAnalysesByContract.mockResolvedValue({ deletedCount: 1 });

        const req = {
            orgId: 'org123',
            user: { userId: 'user1' },
            params: { contractId: '64a1b2c3d4e5f6a7b8c9d0e2' },
        };
        const res = mockRes();

        await deleteAnalysesByContract(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe('1 analysis deleted.');
    });

    it('uses plural "analyses" in message when deletedCount is 0', async () => {
        mockDeleteAnalysesByContract.mockResolvedValue({ deletedCount: 0 });

        const req = {
            orgId: 'org123',
            user: { userId: 'user1' },
            params: { contractId: '64a1b2c3d4e5f6a7b8c9d0e2' },
        };
        const res = mockRes();

        await deleteAnalysesByContract(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe('0 analyses deleted.');
    });

    it('uses plural "analyses" in message when deletedCount > 1', async () => {
        mockDeleteAnalysesByContract.mockResolvedValue({ deletedCount: 5 });

        const req = {
            orgId: 'org123',
            user: { userId: 'user1' },
            params: { contractId: '64a1b2c3d4e5f6a7b8c9d0e2' },
        };
        const res = mockRes();

        await deleteAnalysesByContract(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe('5 analyses deleted.');
    });

    it('passes correct args to the service', async () => {
        mockDeleteAnalysesByContract.mockResolvedValue({ deletedCount: 2 });

        const contractId = '64a1b2c3d4e5f6a7b8c9d0e2';
        const req = {
            orgId: 'org999',
            user: { userId: 'user77' },
            params: { contractId },
        };
        const res = mockRes();

        await deleteAnalysesByContract(req, res);

        expect(mockDeleteAnalysesByContract).toHaveBeenCalledWith(contractId, 'org999', 'user77');
    });
});
