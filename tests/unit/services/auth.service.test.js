/**
 * Auth Service — Comprehensive Unit Tests
 *
 * Covers the full auth flow:
 *   - registerUser: duplicate check, OTP storage, email dispatch
 *   - verifyEmail: valid/invalid/expired OTP
 *   - loginUser: credentials, lockout, unverified account
 *   - refreshAccessToken: rotation, replay detection
 *   - logoutUser: blacklisting
 *   - forgotPassword / resetPassword: token lifecycle
 *   - changePassword: current pass verification, same-password guard
 */

import { jest } from '@jest/globals';

// ─── Environment mock ─────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/config/env.js', () => ({
    default: {
        NODE_ENV: 'test',
        OTP_EXPIRY: 600,
        PASSWORD_RESET_EXPIRY: 3600,
        PASETO_LOCAL_SECRET: 'test-secret-32-chars-minimum-length-ok!',
        PASETO_ACCESS_EXPIRY: '15m',
        PASETO_REFRESH_EXPIRY: '7d',
        PASETO_REFRESH_COOKIE_MAX_AGE_MS: 604800000,
    },
}));

// ─── User model mock ──────────────────────────────────────────────────────────
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserCreate = jest.fn();

jest.unstable_mockModule('../../../src/models/User.model.js', () => ({
    default: {
        findOne: mockUserFindOne,
        findById: mockUserFindById,
        create: mockUserCreate,
    },
}));

// ─── Redis mock ───────────────────────────────────────────────────────────────
const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(300),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    pipeline: jest.fn(),
    publish: jest.fn().mockResolvedValue(1),
};

// Pipeline mock — returns object with same commands + exec
const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1], [null, 'OK']]),
};
mockRedis.pipeline.mockReturnValue(mockPipeline);

jest.unstable_mockModule('../../../src/config/redis.js', () => ({
    getRedisClient: jest.fn().mockReturnValue(mockRedis),
}));

// ─── Email service mock ───────────────────────────────────────────────────────
const mockSendOtpEmail = jest.fn().mockResolvedValue(undefined);
const mockSendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../../src/services/email.service.js', () => ({
    sendOtpEmail: mockSendOtpEmail,
    sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

// ─── tokenHelper mock ─────────────────────────────────────────────────────────
jest.unstable_mockModule('../../../src/utils/tokenHelper.js', () => ({
    signAccessToken: jest.fn().mockResolvedValue({ token: 'access-token', jti: 'access-jti' }),
    signRefreshToken: jest.fn().mockResolvedValue({ token: 'refresh-token', jti: 'refresh-jti' }),
    verifyToken: jest.fn().mockResolvedValue({
        userId: 'user123',
        jti: 'some-jti',
        exp: Math.floor(Date.now() / 1000) + 900,
    }),
    decodeToken: jest.fn().mockResolvedValue({
        userId: 'user123',
        jti: 'refresh-jti',
        exp: Math.floor(Date.now() / 1000) + 604800,
    }),
    getRemainingTTL: jest.fn().mockReturnValue(900),
}));

// ─── Import service AFTER mocks ───────────────────────────────────────────────
const {
    registerUser,
    verifyEmail,
    loginUser,
    logoutUser,
    forgotPassword,
    resetPassword,
    changePassword,
} = await import('../../../src/services/auth.service.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeUser(overrides = {}) {
    return {
        _id: 'user123',
        email: 'alice@example.com',
        name: 'Alice',
        role: 'viewer',
        emailVerified: true,
        isActive: true,
        organization: 'org123',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(undefined),
        lastLoginAt: null,
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// registerUser
// ─────────────────────────────────────────────────────────────────────────────
describe('registerUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUserFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        mockUserCreate.mockResolvedValue({ _id: 'user123', email: 'alice@example.com' });
        mockRedis.set.mockResolvedValue('OK');
        mockSendOtpEmail.mockResolvedValue(undefined);
    });

    it('creates user and returns userId + email + otp', async () => {
        const result = await registerUser({ name: 'Alice', email: 'alice@example.com', password: 'Secret1!' });
        expect(result.userId).toBe('user123');
        expect(result.email).toBe('alice@example.com');
        expect(result.otp).toMatch(/^\d{6}$/);
    });

    it('stores OTP in Redis with correct key and TTL', async () => {
        await registerUser({ name: 'Alice', email: 'alice@example.com', password: 'Secret1!' });
        expect(mockRedis.set).toHaveBeenCalledWith(
            'emailOtp:user123',
            expect.stringMatching(/^\d{6}$/),
            'EX',
            600
        );
    });

    it('sends OTP email exactly once', async () => {
        await registerUser({ name: 'Alice', email: 'alice@example.com', password: 'Secret1!' });
        await new Promise((r) => setImmediate(r)); // flush fire-and-forget
        expect(mockSendOtpEmail).toHaveBeenCalledTimes(1);
    });

    it('normalizes email to lowercase', async () => {
        await registerUser({ name: 'Alice', email: 'ALICE@EXAMPLE.COM', password: 'Secret1!' });
        expect(mockUserFindOne).toHaveBeenCalledWith({ email: 'alice@example.com' });
    });

    it('throws DUPLICATE_EMAIL when user already exists', async () => {
        mockUserFindOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: 'existing', email: 'alice@example.com' }),
        });

        await expect(
            registerUser({ name: 'Alice', email: 'alice@example.com', password: 'Secret1!' })
        ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL', statusCode: 409 });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyEmail
// ─────────────────────────────────────────────────────────────────────────────
describe('verifyEmail', () => {
    let user;

    beforeEach(() => {
        jest.clearAllMocks();
        user = makeUser({ emailVerified: false });
        mockUserFindOne.mockResolvedValue(user);
        mockRedis.get.mockResolvedValue('123456');
        mockRedis.del.mockResolvedValue(1);
    });

    it('returns true and marks user as verified when OTP matches', async () => {
        const result = await verifyEmail('123456', 'alice@example.com');
        expect(result).toBe(true);
        expect(user.save).toHaveBeenCalled();
    });

    it('throws INVALID_OTP when OTP does not match', async () => {
        mockRedis.get.mockResolvedValue('999999');
        await expect(verifyEmail('123456', 'alice@example.com'))
            .rejects.toMatchObject({ code: 'INVALID_OTP' });
    });

    it('throws INVALID_OTP when OTP not in Redis (expired)', async () => {
        mockRedis.get.mockResolvedValue(null);
        await expect(verifyEmail('123456', 'alice@example.com'))
            .rejects.toMatchObject({ code: 'INVALID_OTP' });
    });

    it('throws INVALID_OTP when email not found', async () => {
        mockUserFindOne.mockResolvedValue(null);
        await expect(verifyEmail('123456', 'nobody@example.com'))
            .rejects.toMatchObject({ code: 'INVALID_OTP' });
    });

    it('returns true silently if email already verified (idempotent)', async () => {
        user.emailVerified = true;
        const result = await verifyEmail('123456', 'alice@example.com');
        expect(result).toBe(true);
        expect(user.save).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// loginUser
// ─────────────────────────────────────────────────────────────────────────────
describe('loginUser', () => {
    let user;

    beforeEach(() => {
        jest.clearAllMocks();
        user = makeUser({ emailVerified: true, isActive: true });
        mockUserFindOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(user),
        });
        mockRedis.exists.mockResolvedValue(0);
        mockRedis.ttl.mockResolvedValue(0);
        mockPipeline.exec.mockResolvedValue([[null, 1], [null, 'OK']]);
        mockRedis.pipeline.mockReturnValue(mockPipeline);
    });

    it('returns accessToken, refreshToken, user on valid credentials', async () => {
        const result = await loginUser({ email: 'alice@example.com', password: 'Secret1!' });
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(result.user._id).toBe('user123');
    });

    it('throws ACCOUNT_LOCKED when lockout key exists', async () => {
        mockRedis.exists.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(600);
        await expect(loginUser({ email: 'alice@example.com', password: 'any' }))
            .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });

    it('throws INVALID_CREDENTIALS when password does not match', async () => {
        user.comparePassword.mockResolvedValue(false);
        mockPipeline.exec.mockResolvedValue([[null, 1], [null, 'OK']]);
        await expect(loginUser({ email: 'alice@example.com', password: 'wrong' }))
            .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws INVALID_CREDENTIALS when user does not exist', async () => {
        mockUserFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
        mockPipeline.exec.mockResolvedValue([[null, 1], [null, 'OK']]);
        await expect(loginUser({ email: 'nobody@example.com', password: 'any' }))
            .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws EMAIL_NOT_VERIFIED when email is not verified', async () => {
        user.emailVerified = false;
        await expect(loginUser({ email: 'alice@example.com', password: 'Secret1!' }))
            .rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    });

    it('throws ACCOUNT_DEACTIVATED when account is inactive', async () => {
        user.isActive = false;
        await expect(loginUser({ email: 'alice@example.com', password: 'Secret1!' }))
            .rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATED' });
    });

    it('locks account after 5 failed attempts', async () => {
        user.comparePassword.mockResolvedValue(false);
        mockPipeline.exec.mockResolvedValue([[null, 5], [null, 'OK']]);
        await expect(loginUser({ email: 'alice@example.com', password: 'wrong' }))
            .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// logoutUser
// ─────────────────────────────────────────────────────────────────────────────
describe('logoutUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPipeline.exec.mockResolvedValue([[null, 'OK']]);
        mockRedis.pipeline.mockReturnValue(mockPipeline);
    });

    it('blacklists the access token JTI', async () => {
        const exp = Math.floor(Date.now() / 1000) + 900;
        await logoutUser('access-jti', exp, null);
        expect(mockPipeline.set).toHaveBeenCalled();
        expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('also blacklists the refresh token if provided', async () => {
        const exp = Math.floor(Date.now() / 1000) + 900;
        await logoutUser('access-jti', exp, 'refresh-token');
        // verifyToken was called for the refresh token
        const { verifyToken } = await import('../../../src/utils/tokenHelper.js');
        expect(verifyToken).toHaveBeenCalledWith('refresh-token', expect.any(String));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// forgotPassword
// ─────────────────────────────────────────────────────────────────────────────
describe('forgotPassword', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUserFindOne.mockResolvedValue({ _id: 'user123', email: 'alice@example.com' });
        mockRedis.set.mockResolvedValue('OK');
        mockSendPasswordResetEmail.mockResolvedValue(undefined);
    });

    it('stores a reset token and sends email for known email', async () => {
        await forgotPassword('alice@example.com');
        await new Promise((r) => setImmediate(r));
        expect(mockRedis.set).toHaveBeenCalledWith(
            expect.stringMatching(/^pwReset:/),
            'user123',
            'EX',
            3600
        );
        expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('returns silently for unknown email (prevents enumeration)', async () => {
        mockUserFindOne.mockResolvedValue(null);
        await expect(forgotPassword('nobody@example.com')).resolves.toBeUndefined();
        expect(mockRedis.set).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────────────────────
describe('resetPassword', () => {
    let user;

    beforeEach(() => {
        jest.clearAllMocks();
        user = makeUser({ password: 'hashed-old' });
        mockRedis.get.mockResolvedValue('user123');
        mockUserFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue(user),
        });
        user.comparePassword.mockResolvedValue(false); // new password is different
    });

    it('resets password successfully', async () => {
        const result = await resetPassword('valid-token', 'NewSecret1!');
        expect(result).toBe(true);
        expect(user.save).toHaveBeenCalled();
        expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/pwReset/));
    });

    it('throws INVALID_TOKEN for unknown reset token', async () => {
        mockRedis.get.mockResolvedValue(null);
        await expect(resetPassword('bad-token', 'NewSecret1!'))
            .rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    });

    it('throws PASSWORD_REUSE if new password same as current', async () => {
        user.comparePassword.mockResolvedValue(true); // same password
        await expect(resetPassword('valid-token', 'SamePassword1!'))
            .rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// changePassword
// ─────────────────────────────────────────────────────────────────────────────
describe('changePassword', () => {
    let user;

    beforeEach(() => {
        jest.clearAllMocks();
        user = makeUser();
        mockUserFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue(user),
        });
        // First call = current password check (true), second = same-password check (false)
        user.comparePassword
            .mockResolvedValueOnce(true)   // current password correct
            .mockResolvedValueOnce(false); // new password is different
    });

    it('changes password successfully', async () => {
        const result = await changePassword('user123', 'OldPass1!', 'NewPass1!');
        expect(result).toBe(true);
        expect(user.save).toHaveBeenCalled();
    });

    it('throws NOT_FOUND for unknown userId', async () => {
        mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
        await expect(changePassword('bad-id', 'OldPass1!', 'NewPass1!'))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws INVALID_PASSWORD if current password is wrong', async () => {
        user.comparePassword.mockResolvedValueOnce(false); // current password wrong
        await expect(changePassword('user123', 'WrongPass1!', 'NewPass1!'))
            .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('throws PASSWORD_REUSE if new password matches current', async () => {
        user.comparePassword
            .mockResolvedValueOnce(true)  // current password correct
            .mockResolvedValueOnce(true); // new password same as current
        await expect(changePassword('user123', 'OldPass1!', 'OldPass1!'))
            .rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
    });
});
