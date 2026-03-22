/**
 * PASETO Token Helpers
 *
 * Sign and verify access and refresh tokens using PASETO v3 local
 * (AES-256-CTR + HMAC-SHA384 symmetric authenticated encryption).
 *
 * Token lifecycle:
 *   - Access tokens:  short-lived (15m default), sent in Authorization header
 *   - Refresh tokens: long-lived (7d default), stored as HttpOnly cookie
 *   - Every token gets a unique JTI (UUID v4) for blacklist tracking on logout
 *
 * Note: email verification and password reset tokens are NOT PASETO tokens.
 * They use crypto.randomBytes hex strings stored directly in Redis
 * (see auth.service.js). This module only handles access and refresh tokens.
 *
 * Error name compatibility:
 *   auth.middleware.js catches err.name === 'TokenExpiredError' and 'JsonWebTokenError'.
 *   This module maps PASETO errors to those same names so the middleware needs no changes.
 */

import { createHash, createSecretKey, randomUUID } from 'crypto';
import { V3 } from 'paseto';

// ─────────────────────────────────────────────────────────────────────────────
// Key derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a 32-byte symmetric KeyObject from an arbitrary secret string.
 * PASETO v3 local requires exactly 32 bytes — we SHA-256 hash the secret
 * so any length input produces a valid key.
 *
 * @param {string} secret
 * @returns {KeyObject}
 */
function deriveKey(secret) {
    const keyBytes = createHash('sha256').update(secret).digest();
    return createSecretKey(keyBytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry parsing
// ─────────────────────────────────────────────────────────────────────────────

const EXPIRY_UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Parse an expiry string like '15m', '7d', '1h', '30s' into seconds.
 * Used to compute the numeric exp value for getRemainingTTL compatibility.
 *
 * @param {string} expiresIn
 * @returns {number} seconds
 */
function parseExpiry(expiresIn) {
    const match = String(expiresIn).match(/^(\d+)([smhd])$/);
    if (!match) {
        throw new TypeError(`Invalid expiresIn format: "${expiresIn}". Expected e.g. '15m', '7d', '1h', '30s'`);
    }
    return parseInt(match[1], 10) * EXPIRY_UNITS[match[2]];
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After decryption, the paseto library returns exp as an ISO8601 string.
 * Convert it to a Unix epoch number for compatibility with getRemainingTTL
 * and auth.middleware.js which expect a numeric exp.
 *
 * @param {object} payload
 * @returns {object} payload with exp as Unix epoch number
 */
function normalizePayload(payload) {
    if (payload && typeof payload.exp === 'string') {
        payload.exp = Math.floor(new Date(payload.exp).getTime() / 1000);
    }
    return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token signing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign an access token.
 * Payload contains everything needed for auth checks without hitting the DB.
 *
 * @param {{ userId, orgId, role }} payload
 * @param {string} secret   — PASETO_LOCAL_SECRET
 * @param {string} expiresIn — e.g. '15m'
 * @returns {Promise<{ token: string, jti: string }>}
 */
export async function signAccessToken(payload, secret, expiresIn) {
    const jti = randomUUID();
    const key = deriveKey(secret);
    // Validate format early (parseExpiry throws on invalid format)
    parseExpiry(expiresIn);

    const token = await V3.encrypt(
        { userId: payload.userId, orgId: payload.orgId, role: payload.role, jti },
        key,
        { iat: false, expiresIn }
    );

    return { token, jti };
}

/**
 * Sign a refresh token.
 * Only carries userId — org/role is fetched fresh on refresh so changes
 * take effect without waiting for the access token to expire.
 *
 * @param {{ userId }} payload
 * @param {string} secret   — PASETO_LOCAL_SECRET
 * @param {string} expiresIn — e.g. '7d'
 * @returns {Promise<{ token: string, jti: string }>}
 */
export async function signRefreshToken(payload, secret, expiresIn) {
    const jti = randomUUID();
    const key = deriveKey(secret);
    // Validate format early (parseExpiry throws on invalid format)
    parseExpiry(expiresIn);

    const token = await V3.encrypt(
        { userId: payload.userId, jti },
        key,
        { iat: false, expiresIn }
    );

    return { token, jti };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a PASETO token and return the decoded payload.
 *
 * Throws an error with:
 *   - .name = 'TokenExpiredError' and .expiredAt set when the token is expired
 *   - .name = 'JsonWebTokenError' for any other failure (wrong key, invalid format, JWT string, etc.)
 *
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object>} Decoded payload with exp as Unix epoch number
 */
export async function verifyToken(token, secret) {
    try {
        const key = deriveKey(secret);
        // Let the library validate expiry natively (throws PasetoClaimInvalid when expired)
        const decoded = await V3.decrypt(token, key);
        return normalizePayload(decoded);
    } catch (err) {
        // PasetoClaimInvalid with 'token is expired' → TokenExpiredError
        if (err.code === 'ERR_PASETO_CLAIM_INVALID' && err.message === 'token is expired') {
            // Re-decrypt without expiry check to get the expiredAt timestamp
            let expiredAt = new Date();
            try {
                const key2 = deriveKey(secret);
                const raw = await V3.decrypt(token, key2, { ignoreExp: true });
                if (raw.exp) expiredAt = new Date(raw.exp);
            } catch {
                // ignore — use current date as fallback
            }
            const expiredErr = new Error('Token has expired');
            expiredErr.name = 'TokenExpiredError';
            expiredErr.expiredAt = expiredAt;
            throw expiredErr;
        }

        // All other errors (wrong key, invalid format, JWT string, etc.) → JsonWebTokenError
        const jwtErr = new Error(err.message || 'Invalid PASETO token');
        jwtErr.name = 'JsonWebTokenError';
        throw jwtErr;
    }
}

/**
 * Decrypt a PASETO token WITHOUT performing expiry validation.
 * Used to read the exp claim for blacklist TTL calculation on expired tokens.
 * Never throws — returns null on any error.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object|null>}
 */
export async function decodeToken(token, secret) {
    try {
        const key = deriveKey(secret);
        const decoded = await V3.decrypt(token, key, { ignoreExp: true });
        return normalizePayload(decoded);
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TTL helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate remaining TTL in seconds from a token's exp claim.
 * Redis EXPIRE requires at least 1 second — return minimum of 1.
 *
 * @param {number} exp — seconds since epoch
 * @returns {number}
 */
export function getRemainingTTL(exp) {
    return Math.max(exp - Math.floor(Date.now() / 1000), 1);
}
