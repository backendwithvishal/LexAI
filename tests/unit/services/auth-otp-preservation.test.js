/**
 * Preservation Property Tests — OTP Registration Baseline Behavior
 *
 * Property 2: Preservation — Non-Buggy Registration Inputs Behave Identically
 *
 * These tests MUST PASS on unfixed code. They establish the baseline behavior
 * that must remain unchanged after the fix is applied:
 *   - Duplicate email always throws DUPLICATE_EMAIL (any environment)
 *   - emailService.sendOtpEmail is called exactly once per successful registration
 *   - redis.set is called with the correct key, OTP value, EX, and OTP_EXPIRY
 *   - In development, result.otp is defined and matches /^\d{6}$/
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { jest } from '@jest/globals';
import { testProp, fc } from '@fast-check/jest';

// ─── Mock: env — development environment (so unfixed code still returns otp) ──
jest.unstable_mockModule('../../../src/config/env.js', () => ({
    default: {
        NODE_ENV: 'development',
        OTP_EXPIRY: 600,
        PASSWORD_RESET_EXPIRY: 3600,
        PASETO_LOCAL_SECRET: 'test-secret-at-least-32-chars-long!!',
        PASETO_ACCESS_EXPIRY: '15m',
        PASETO_REFRESH_EXPIRY: '7d',
        PASETO_REFRESH_COOKIE_MAX_AGE_MS: 604800000,
    },
}));

// ─── Mock: User model ─────────────────────────────────────────────────────────
// findOne returns a thenable with .lean() so the service's `.lean()` call works
const mockFindOne = jest.fn();
const mockCreate = jest.fn();

// Helper: make findOne return a value via .lean()
function mockFindOneReturning(value) {
    mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
}

jest.unstable_mockModule('../../../src/models/User.model.js', () => ({
    default: {
        findOne: mockFindOne,
        create: mockCreate,
    },
}));

// ─── Mock: Redis client ───────────────────────────────────────────────────────
const mockRedisSet = jest.fn().mockResolvedValue('OK');

jest.unstable_mockModule('../../../src/config/redis.js', () => ({
    getRedisClient: jest.fn().mockReturnValue({
        set: mockRedisSet,
    }),
}));

// ─── Mock: Email service ──────────────────────────────────────────────────────
const mockSendOtpEmail = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../../src/services/email.service.js', () => ({
    sendOtpEmail: mockSendOtpEmail,
}));

// ─── Import module AFTER all mocks are registered ────────────────────────────
const { registerUser } = await import('../../../src/services/auth.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFakeUser(email = 'alice@example.com') {
    return {
        _id: 'user123',
        email,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Property-Based Test 1: Duplicate email always throws DUPLICATE_EMAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: duplicate email always throws DUPLICATE_EMAIL', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * Property: For any email string, when User.findOne returns an existing user,
     * registerUser always throws AppError with code DUPLICATE_EMAIL.
     * This must hold in all environments — same before and after the fix.
     *
     * Validates: Requirements 3.6
     */
    testProp(
        'throws DUPLICATE_EMAIL for any email when user already exists',
        [
            fc.emailAddress(),  // any email string
        ],
        async (email) => {
            jest.clearAllMocks();

            // Simulate an existing user in the DB — must re-set after clearAllMocks
            mockFindOneReturning({ _id: 'existing-user', email });

            let thrownError = null;
            try {
                await registerUser({ name: 'Alice', email, password: 'Secret1!' });
            } catch (err) {
                thrownError = err;
            }

            // Must always throw with DUPLICATE_EMAIL code
            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('DUPLICATE_EMAIL');
        },
        { numRuns: 50 }
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test 2: emailService.sendOtpEmail is called once per successful registration
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: emailService.sendOtpEmail called exactly once per registration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // No duplicate — registration proceeds
        mockFindOneReturning(null);
        mockCreate.mockResolvedValue(makeFakeUser('alice@example.com'));
        mockRedisSet.mockResolvedValue('OK');
        mockSendOtpEmail.mockResolvedValue(undefined);
    });

    /**
     * sendOtpEmail must be called exactly once with the correct email address
     * on every successful registration. This behavior must be preserved after the fix.
     *
     * Validates: Requirements 3.1
     */
    it('calls sendOtpEmail exactly once with the correct email', async () => {
        const email = 'alice@example.com';

        await registerUser({ name: 'Alice', email, password: 'Secret1!' });

        // Wait a tick for the fire-and-forget email to resolve
        await new Promise((resolve) => setImmediate(resolve));

        expect(mockSendOtpEmail).toHaveBeenCalledTimes(1);
        expect(mockSendOtpEmail).toHaveBeenCalledWith(
            email,
            expect.stringMatching(/^\d{6}$/)
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test 3: redis.set called with correct key, OTP value, EX, and OTP_EXPIRY
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: redis.set called with correct key, OTP, EX, and OTP_EXPIRY', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindOneReturning(null);
        mockCreate.mockResolvedValue(makeFakeUser('alice@example.com'));
        mockRedisSet.mockResolvedValue('OK');
        mockSendOtpEmail.mockResolvedValue(undefined);
    });

    /**
     * redis.set must be called with:
     *   - key: 'emailOtp:user123'
     *   - value: a 6-digit OTP string
     *   - 'EX'
     *   - 600 (OTP_EXPIRY)
     *
     * This Redis storage behavior must be preserved after the fix.
     *
     * Validates: Requirements 3.2
     */
    it('calls redis.set with emailOtp:{userId}, 6-digit OTP, EX, and OTP_EXPIRY (600)', async () => {
        await registerUser({ name: 'Alice', email: 'alice@example.com', password: 'Secret1!' });

        expect(mockRedisSet).toHaveBeenCalledWith(
            'emailOtp:user123',
            expect.stringMatching(/^\d{6}$/),
            'EX',
            600
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test 4: In development, result.otp is defined and matches /^\d{6}$/
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: in development, result.otp is defined and matches /^\\d{6}$/', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindOneReturning(null);
        mockCreate.mockResolvedValue(makeFakeUser('alice@example.com'));
        mockRedisSet.mockResolvedValue('OK');
        mockSendOtpEmail.mockResolvedValue(undefined);
    });

    /**
     * In development (NODE_ENV === 'development'), result.otp must be defined
     * and match /^\d{6}$/. This is the baseline — it passes on unfixed code
     * and must still pass after the fix.
     *
     * Validates: Requirements 3.4, 3.5
     */
    it('result.otp is defined and matches /^\\d{6}$/ in development', async () => {
        const result = await registerUser({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'Secret1!',
        });

        expect(result.otp).toBeDefined();
        expect(result.otp).toMatch(/^\d{6}$/);
    });
});
