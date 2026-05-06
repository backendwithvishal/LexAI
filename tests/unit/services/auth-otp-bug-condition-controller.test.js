/**
 * Bug Condition Fix Validation — Controller-level
 *
 * Verifies that after the fix, the register controller always passes
 * otp: result.otp to sendSuccess unconditionally, regardless of environment.
 *
 * The mock returns { userId, email, otp: '048291' } — simulating the FIXED
 * service — and the test asserts that data.otp === '048291' in the sendSuccess
 * call, confirming the controller passes it through without any conditional guard.
 *
 * Validates: Requirements 1.1, 1.2
 */

import { jest } from '@jest/globals';

// ─── Mock: apiResponse utility ────────────────────────────────────────────────
let capturedSendSuccessArgs = null;
jest.unstable_mockModule('../../../src/utils/apiResponse.js', () => ({
    sendSuccess: jest.fn().mockImplementation((res, args) => {
        capturedSendSuccessArgs = args;
    }),
    sendError: jest.fn(),
}));

// ─── Mock: auth.service.js — simulates the FIXED service ─────────────────────
// Returns { userId, email, otp } — the fixed service always includes otp
jest.unstable_mockModule('../../../src/services/auth.service.js', () => ({
    registerUser: jest.fn().mockResolvedValue({
        userId: 'user123',
        email: 'alice@example.com',
        otp: '048291',
    }),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    loginUser: jest.fn(),
    refreshAccessToken: jest.fn(),
    logoutUser: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    listRefreshTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllRefreshTokens: jest.fn(),
    buildRefreshCookieOptions: jest.fn().mockReturnValue({}),
}));

// ─── Mock: enrichment service (used by controller) ───────────────────────────
jest.unstable_mockModule('../../../src/services/enrichment.service.js', () => ({
    checkDisposableEmail: jest.fn().mockResolvedValue({ disposable: false }),
    getIPInfo: jest.fn().mockResolvedValue(null),
}));

// ─── Mock: audit service (used by controller) ────────────────────────────────
jest.unstable_mockModule('../../../src/services/audit.service.js', () => ({
    log: jest.fn().mockResolvedValue(undefined),
}));

// ─── Import the controller AFTER all mocks are registered ────────────────────
const { register } = await import('../../../src/controllers/auth.controller.js');

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Controller-level — OTP passed through to sendSuccess
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix Validation: Controller — OTP passed through to sendSuccess unconditionally', () => {
    beforeEach(() => {
        capturedSendSuccessArgs = null;
        jest.clearAllMocks();
    });

    /**
     * After the fix, the controller uses `otp: result.otp` unconditionally
     * (no `if (result.otp)` guard). This test mocks registerUser to return
     * { userId, email, otp: '048291' } and asserts that data.otp === '048291'
     * in the sendSuccess call — confirming the controller passes it through.
     *
     * Validates: Requirements 1.1, 1.2
     */
    it('data.otp passed to sendSuccess equals the otp returned by the service', async () => {
        const req = {
            body: {
                name: 'Alice',
                email: 'alice@example.com',
                password: 'Secret1!',
            },
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-agent'),
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        await register(req, res);

        expect(capturedSendSuccessArgs).not.toBeNull();
        expect(capturedSendSuccessArgs.data).toBeDefined();
        expect(capturedSendSuccessArgs.data.otp).toBe('048291');
    });
});
