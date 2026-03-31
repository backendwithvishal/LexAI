import { jest } from '@jest/globals';
import { sendSuccess, sendError, buildPaginationMeta } from '../../../src/utils/apiResponse.js';

// Minimal mock for Express response object
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('sendSuccess', () => {
    it('returns 200 with success:true by default', () => {
        const res = mockRes();
        sendSuccess(res, { data: { id: 1 } });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('includes message when provided', () => {
        const res = mockRes();
        sendSuccess(res, { message: 'Done' });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Done' }));
    });

    it('uses custom statusCode', () => {
        const res = mockRes();
        sendSuccess(res, { statusCode: 201 });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('omits undefined fields from response body', () => {
        const res = mockRes();
        sendSuccess(res, {});
        const body = res.json.mock.calls[0][0];
        expect(body).not.toHaveProperty('message');
        expect(body).not.toHaveProperty('data');
    });
});

describe('sendError', () => {
    it('returns 500 with success:false by default', () => {
        const res = mockRes();
        sendError(res, {});
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('includes error code and message', () => {
        const res = mockRes();
        sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' });
        expect(res.status).toHaveBeenCalledWith(404);
        const body = res.json.mock.calls[0][0];
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Not found');
    });

    it('includes details when provided', () => {
        const res = mockRes();
        sendError(res, { details: [{ field: 'email', message: 'Invalid' }] });
        const body = res.json.mock.calls[0][0];
        expect(body.error.details).toHaveLength(1);
    });
});

describe('buildPaginationMeta', () => {
    it('calculates totalPages correctly', () => {
        const meta = buildPaginationMeta(100, 1, 10);
        expect(meta.totalPages).toBe(10);
    });

    it('sets hasNextPage and hasPrevPage correctly', () => {
        const first = buildPaginationMeta(30, 1, 10);
        expect(first.hasNextPage).toBe(true);
        expect(first.hasPrevPage).toBe(false);

        const last = buildPaginationMeta(30, 3, 10);
        expect(last.hasNextPage).toBe(false);
        expect(last.hasPrevPage).toBe(true);
    });

    it('handles single page', () => {
        const meta = buildPaginationMeta(5, 1, 10);
        expect(meta.totalPages).toBe(1);
        expect(meta.hasNextPage).toBe(false);
        expect(meta.hasPrevPage).toBe(false);
    });
});
