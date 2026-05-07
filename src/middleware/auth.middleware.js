/**
 * Auth Middleware
 *
 * Verifies the PASETO access token from the Authorization header.
 * Checks the Redis blacklist to reject revoked tokens (logged-out users).
 * Resolves the user's LIVE role from Redis cache (or DB fallback) so that
 * role changes take effect immediately — without waiting for token expiry.
 *
 * Usage: place authenticate before any route that requires a logged-in user.
 */

import { verifyToken } from '../utils/tokenHelper.js';
import { getRedisClient } from '../config/redis.js';
import { sendError } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { REDIS_KEYS } from '../constants/redisKeys.js';
import User from '../models/User.model.js';

// Role cache TTL — keep it short so a reverted role change also takes effect quickly
const ROLE_CACHE_TTL = 60; // 60 seconds

/**
 * Protect routes — requires a valid, non-blacklisted PASETO access token.
 *
 * Expected header:  Authorization: Bearer <access_token>
 *
 * On success:  populates req.user = { userId, orgId, role, jti, exp }
 *              where `role` is always the LIVE role from Redis/DB,
 *              not the stale role baked into the token at login time.
 * On failure:  returns 401 with an appropriate error code
 */
export async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'UNAUTHORIZED',
                message: 'Access token required. Format: Authorization: Bearer <token>',
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'UNAUTHORIZED',
                message: 'Access token is empty.',
            });
        }

        const decoded = await verifyToken(token, env.PASETO_LOCAL_SECRET);

        // Explicit expiry check — belt-and-suspenders on top of PASETO's own check
        const nowSec = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < nowSec) {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'TOKEN_EXPIRED',
                message: 'Access token has expired. Use POST /auth/refresh-token to get a new one.',
            });
        }

        const redis = getRedisClient();

        // Check if this token has been revoked (user logged out)
        const isBlacklisted = await redis.exists(REDIS_KEYS.blacklist(decoded.jti));
        if (isBlacklisted) {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'TOKEN_REVOKED',
                message: 'This token has been revoked. Please log in again.',
            });
        }

        // ─── Live role resolution ──────────────────────────────────────────
        // The role in the token is the role at login time — it goes stale when
        // an admin changes the user's role. We always resolve the current role
        // from Redis (fast, ~1ms) with a DB fallback (slower, ~5ms).
        // This ensures role changes take effect on the very next request.
        let liveRole = await redis.get(REDIS_KEYS.userRole(decoded.userId));

        if (!liveRole) {
            // Cache miss — fetch from DB and repopulate the cache
            const user = await User.findById(decoded.userId).select('role isActive').lean();

            if (!user) {
                return sendError(res, {
                    statusCode: HTTP.UNAUTHORIZED,
                    code: 'UNAUTHORIZED',
                    message: 'User account not found. Please log in again.',
                });
            }

            if (user.isActive === false) {
                return sendError(res, {
                    statusCode: HTTP.UNAUTHORIZED,
                    code: 'ACCOUNT_DEACTIVATED',
                    message: 'Your account has been deactivated. Please contact support.',
                });
            }

            liveRole = user.role;
            // Cache the live role — short TTL so reverted changes also propagate quickly
            await redis.set(REDIS_KEYS.userRole(decoded.userId), liveRole, 'EX', ROLE_CACHE_TTL);
        }
        // ──────────────────────────────────────────────────────────────────

        // Attach user info — role is always the live value, never the stale token value
        req.user = {
            userId: decoded.userId,
            orgId: decoded.orgId,
            role: liveRole,
            jti: decoded.jti,
            exp: decoded.exp,
        };

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'TOKEN_EXPIRED',
                message: 'Access token has expired. Use POST /auth/refresh-token to get a new one.',
            });
        }

        if (err.name === 'InvalidTokenError') {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'INVALID_TOKEN',
                message: 'Invalid access token.',
            });
        }

        logger.error({ err: err.message }, 'Unexpected error in auth middleware');
        return sendError(res, {
            statusCode: HTTP.INTERNAL_ERROR,
            code: 'INTERNAL_ERROR',
            message: 'Authentication check failed. Please try again.',
        });
    }
}
