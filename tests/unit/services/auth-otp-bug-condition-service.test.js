/**
 * Bug Condition Fix Validation — Service-level
 *
 * Verifies that after the fix, registerUser always returns result.otp
 * regardless of NODE_ENV (including 'production').
 *
 * Validates: Requirements 1.1, 1.2
 */

import { jest } from '@jest/globals';

// ─── Mock: env — force production environment ─────────────────────────────────
jest.unstable_mockModule('../../../src/config/env.js', () => ({
    default: {
        NODE_ENV: 'production',
        OTP_EXPIRY: 600,
        PASSWORD_RESET_EXPIRY: 3600,
        PASETO_LOCAL_SECRET: 'test-secret',
        PASETO_ACCESS_EXPIRY: '15m',
        PASETO_REFRESH_EXPIRY: '7d',
        PASETO_REFRESH_COOKIE_MAX_AGE_MS: 604800000,
    },
}));

// ─── Mock: User model ─────────────────────────────────────────────────────────
// findOne must support .lean() chaining (auth.service.js calls findOne(...).lean())
jest.unstable_mockModule('../../../src/models/User.model.js', () => ({
    default: {
        findOne: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),  // no duplicate — registration proceeds
        }),
        create: jest.fn().mockResolvedValue({
            _id: 'user123',
            email: 'alice@example.com',
        }),
    },
}));

// ─── Mock: Redis client ───────────────────────────────────────────────────────
const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockPipeline = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
});

jest.unstable_mockModule('../../../src/config/redis.js', () => ({
    getRedisClient: jest.fn().mockReturnValue({
        set: mockRedisSet,
        pipeline: mockPipeline,
    }),
}));

// ─── Mock: Email service ──────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/services/email.service.js', () => ({
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Import the REAL service AFTER all mocks are registered ──────────────────
const { registerUser } = await import('../../../src/services/auth.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Service-level — OTP present in registerUser result in production
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix Validation: Service — OTP present in registerUser result in production', () => {
    /**
     * After the fix, registerUser must always return result.otp regardless of
     * NODE_ENV. This test runs with NODE_ENV === 'production' and asserts that
     * result.otp is defined and matches the 6-digit format.
     *
     * Validates: Requirements 1.1, 1.2
     */
    it('result.otp is defined and matches /^\\d{6}$/ when NODE_ENV is production', async () => {
        const result = await registerUser({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'Secret1!',
        });

        expect(result.otp).toBeDefined();
        expect(result.otp).toMatch(/^\d{6}$/);
    });
});
