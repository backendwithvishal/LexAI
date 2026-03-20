/**
 * Rate Limiter Middleware
 *
 * Redis-backed sliding window rate limiting with per-route presets.
 * Uses a Lua script for atomic INCR + EXPIRE — no race conditions.
 * Fails open if Redis is unavailable (logs the error).
 *
 * Presets:
 *   rateLimiter()           — global: 100 req / 60s
 *   rateLimiter('auth')     — auth endpoints: 10 req / 15min
 *   rateLimiter('strict')   — sensitive ops: 5 req / 15min
 *   rateLimiter('upload')   — file uploads: 20 req / 60s
 *   rateLimiter('analysis') — AI analysis: 30 req / 60s
 *   rateLimiter({ ... })    — custom options
 */

import { getRedisClient } from '../config/redis.js';
import { sendError } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';
import logger from '../utils/logger.js';

// Named presets — tune these to match your traffic patterns
const PRESETS = {
    global:   { windowMs: 60_000,      max: 100 },
    auth:     { windowMs: 15 * 60_000, max: 10  },  // 10 req / 15 min — brute-force guard
    strict:   { windowMs: 15 * 60_000, max: 5   },  // 5 req / 15 min — password reset, OTP
    upload:   { windowMs: 60_000,      max: 20  },  // 20 uploads / min
    analysis: { windowMs: 60_000,      max: 30  },  // 30 AI requests / min
};

// Lua script: atomically increment counter and set TTL on first use.
// Prevents the race condition where a crash between INCR and EXPIRE
// leaves a key without a TTL, permanently blocking requests.
const RATE_LIMIT_SCRIPT = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return current
`;

/**
 * Create a rate limiter middleware.
 *
 * @param {string|object} [preset='global'] - Named preset or custom options
 * @param {number} [preset.windowMs] - Window size in milliseconds
 * @param {number} [preset.max] - Max requests per window
 * @param {string} [preset.keyPrefix] - Custom Redis key prefix
 */
export function rateLimiter(preset = 'global') {
    // Resolve options from preset name or custom object
    let opts;
    if (typeof preset === 'string') {
        opts = PRESETS[preset] ?? PRESETS.global;
    } else {
        opts = { ...PRESETS.global, ...preset };
    }

    const { windowMs, max } = opts;
    const windowSec = Math.ceil(windowMs / 1000);
    const keyPrefix = opts.keyPrefix ?? 'rl';

    return async (req, res, next) => {
        try {
            const redis = getRedisClient();

            // Use real IP — app.set('trust proxy', 1) must be set in app.js
            // so req.ip reflects the client IP, not the proxy IP
            const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

            // Bucket key: changes every window so old counts auto-expire
            const windowKey = Math.floor(Date.now() / windowMs);
            const key = `${keyPrefix}:${ip}:${windowKey}`;

            const current = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, windowSec);

            const resetTime = Math.ceil(((windowKey + 1) * windowMs) / 1000);
            const remaining = Math.max(0, max - current);

            // Standard rate-limit response headers
            res.set('X-RateLimit-Limit', String(max));
            res.set('X-RateLimit-Remaining', String(remaining));
            res.set('X-RateLimit-Reset', String(resetTime));

            if (current > max) {
                const retryAfter = Math.ceil((resetTime * 1000 - Date.now()) / 1000);
                res.set('Retry-After', String(retryAfter));

                logger.warn('Rate limit exceeded', { ip, key, current, max });

                return sendError(res, {
                    statusCode: HTTP.TOO_MANY_REQUESTS,
                    code: 'RATE_LIMITED',
                    message: `Too many requests. Please try again in ${retryAfter} seconds.`,
                    details: [{ retryAfter }],
                });
            }

            next();
        } catch (err) {
            // Fail open — never block a user because Redis is down
            logger.error('Rate limiter error (failing open):', err.message);
            next();
        }
    };
}

/**
 * Brute-force lockout for login/OTP endpoints.
 *
 * Tracks failed attempts per IP+identifier (e.g. email).
 * After maxAttempts failures, locks out for lockoutMs.
 * Resets on successful authentication (call resetBruteForce()).
 *
 * @param {object} options
 * @param {number} [options.maxAttempts=5]   - Failures before lockout
 * @param {number} [options.lockoutMs=900000] - Lockout duration (default 15 min)
 * @param {string} [options.identifierField='email'] - req.body field to use as identifier
 */
export function bruteForceProtection(options = {}) {
    const {
        maxAttempts = 5,
        lockoutMs = 15 * 60_000,
        identifierField = 'email',
    } = options;

    const lockoutSec = Math.ceil(lockoutMs / 1000);

    return async (req, res, next) => {
        try {
            const redis = getRedisClient();
            const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
            const identifier = req.body?.[identifierField]?.toLowerCase?.() ?? 'unknown';
            const key = `bf:${ip}:${identifier}`;

            const attempts = parseInt(await redis.get(key)) || 0;

            if (attempts >= maxAttempts) {
                const ttl = await redis.ttl(key);
                const retryAfter = ttl > 0 ? ttl : lockoutSec;

                logger.warn('Brute-force lockout triggered', { ip, identifier, attempts });

                res.set('Retry-After', String(retryAfter));
                return sendError(res, {
                    statusCode: HTTP.TOO_MANY_REQUESTS,
                    code: 'ACCOUNT_LOCKED',
                    message: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
                    details: [{ retryAfter }],
                });
            }

            // Attach helper to increment failure count — called in auth controller on failure
            req._bruteForceKey = key;
            req._bruteForceMax = maxAttempts;
            req._bruteForceLockoutSec = lockoutSec;

            next();
        } catch (err) {
            logger.error('Brute-force middleware error (failing open):', err.message);
            next();
        }
    };
}

/**
 * Record a failed authentication attempt.
 * Call this in your controller when login/OTP fails.
 *
 * @param {import('express').Request} req
 */
export async function recordFailedAttempt(req) {
    if (!req._bruteForceKey) return;
    try {
        const redis = getRedisClient();
        const current = await redis.incr(req._bruteForceKey);
        if (current === 1) {
            await redis.expire(req._bruteForceKey, req._bruteForceLockoutSec);
        }
        logger.warn('Failed auth attempt recorded', {
            key: req._bruteForceKey,
            attempts: current,
            max: req._bruteForceMax,
        });
    } catch (err) {
        logger.error('Failed to record brute-force attempt:', err.message);
    }
}

/**
 * Clear brute-force counter on successful authentication.
 * Call this in your controller when login/OTP succeeds.
 *
 * @param {import('express').Request} req
 */
export async function resetBruteForce(req) {
    if (!req._bruteForceKey) return;
    try {
        const redis = getRedisClient();
        await redis.del(req._bruteForceKey);
    } catch (err) {
        logger.error('Failed to reset brute-force counter:', err.message);
    }
}
