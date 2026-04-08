/**
 * Auth Routes
 *
 * Base path: /api/v1/auth  (mounted in routes/index.js)
 *
 * Public endpoints (no token required):
 *   POST /register                  — Create a new user account
 *   POST /verify-email              — Verify email with OTP
 *   POST /resend-verification-email — Request a new OTP
 *   POST /login                     — Authenticate and receive tokens
 *   POST /refresh-token             — Rotate access token (reads HttpOnly cookie)
 *   POST /forgot-password           — Send password reset email
 *   POST /reset-password            — Reset password with hex token
 *
 * Protected endpoints (require Authorization: Bearer <access_token>):
 *   POST   /logout                  — Revoke access + refresh tokens
 *   POST   /change-password         — Change password while logged in
 *   GET    /sessions                — List active sessions (refresh token JTIs)
 *   DELETE /sessions/:jti           — Revoke a specific session
 *   DELETE /sessions                — Revoke all sessions (log out everywhere)
 *
 * Rate limiting:
 *   authLimiter   — 10 req / 15 min (register, resend, forgot)
 *   strictLimiter — 5 req / 15 min  (login, verify, reset)
 *   loginBrute    — locks account after 5 failed login attempts for 15 min
 */

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { rateLimiter, bruteForceProtection } from '../middleware/rateLimiter.middleware.js';
import * as authValidator from '../validators/auth.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// Named preset limiters — see rateLimiter.middleware.js for window/max values
const authLimiter   = rateLimiter('auth');    // 10 req / 15 min
const strictLimiter = rateLimiter('strict');  // 5 req / 15 min
const otpLimiter    = rateLimiter('strict');  // 5 req / 15 min — OTP brute-force protection
// Brute-force protection: locks by IP + email after 5 failed attempts
const loginBrute = bruteForceProtection({ maxAttempts: 5, lockoutMs: 15 * 60_000, identifierField: 'email' });

// ─── Public ──────────────────────────────────────────────────────────────────

router.post(
    '/register',
    authLimiter,
    validate(authValidator.register),
    asyncWrapper(authController.register)
);

router.post(
    '/verify-email',
    otpLimiter,  // Max 5 OTP attempts per 15 min — prevents brute-force
    validate(authValidator.verifyEmail),
    asyncWrapper(authController.verifyEmail)
);

router.post(
    '/resend-verification-email',
    authLimiter,
    validate(authValidator.resendVerificationEmail),
    asyncWrapper(authController.resendVerificationEmail)
);

router.post(
    '/login',
    strictLimiter,
    loginBrute,  // Check brute-force lockout before hitting the DB
    validate(authValidator.login),
    asyncWrapper(authController.login)
);

router.post(
    '/refresh-token',
    strictLimiter,
    asyncWrapper(authController.refreshToken)
    // No body validation — token is read from the HttpOnly cookie
);

router.post(
    '/forgot-password',
    authLimiter,
    validate(authValidator.forgotPassword),
    asyncWrapper(authController.forgotPassword)
);

router.post(
    '/reset-password',
    strictLimiter,
    validate(authValidator.resetPassword),
    asyncWrapper(authController.resetPassword)
);

// ─── Protected (auth token required) ──────────────────────────────────────

router.post(
    '/logout',
    authenticate,
    asyncWrapper(authController.logout)
);

router.post(
    '/change-password',
    authenticate,
    validate(authValidator.changePassword),
    asyncWrapper(authController.changePassword)
);

// ─── Session management ───────────────────────────────────────────────────

// List all active sessions (refresh token JTIs with remaining TTL)
router.get(
    '/sessions',
    authenticate,
    asyncWrapper(authController.getSessions)
);

// Revoke a specific session by its JTI (e.g., log out a specific device)
router.delete(
    '/sessions/:jti',
    authenticate,
    validate(authValidator.jtiParam, 'params'),
    asyncWrapper(authController.revokeSession)
);

// Revoke all sessions — logs the user out on every device
router.delete(
    '/sessions',
    authenticate,
    asyncWrapper(authController.revokeAllSessions)
);

export default router;
