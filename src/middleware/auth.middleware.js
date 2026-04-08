/**
 * Auth Middleware
 *
 * Verifies the PASETO access token from the Authorization header.
 * Checks the Redis blacklist to reject revoked tokens (logged-out users).
 * Attaches decoded user info to req.user for downstream controllers.
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

/**
 * Protect routes — requires a valid, non-blacklisted PASETO access token.
 *
 * Expected header:  Authorization: Bearer <access_token>
 *
 * On success:  populates req.user = { userId, orgId, role, jti, exp }
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

        // Check if this token has been revoked (user logged out)
        const redis = getRedisClient();
        const isBlacklisted = await redis.exists(REDIS_KEYS.blacklist(decoded.jti));

        if (isBlacklisted) {
            return sendError(res, {
                statusCode: HTTP.UNAUTHORIZED,
                code: 'TOKEN_REVOKED',
                message: 'This token has been revoked. Please log in again.',
            });
        }

        // Attach user info — available to every downstream middleware and controller
        req.user = {
            userId: decoded.userId,
            orgId: decoded.orgId,
            role: decoded.role,
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
