/**
 * Redis Key Constants
 *
 * Centralizes all Redis key patterns in one place.
 * Prevents typos and makes key structure easy to audit.
 *
 * Naming convention: <domain>:<identifier>
 */

export const REDIS_KEYS = {
    // Auth
    emailOtp:        (userId)    => `emailOtp:${userId}`,
    pwReset:         (token)     => `pwReset:${token}`,
    loginFail:       (email)     => `login:fail:${email}`,
    loginLock:       (email)     => `login:lockout:${email}`,
    blacklist:       (jti)       => `blacklist:${jti}`,
    refreshToken:    (jti)       => `refreshToken:${jti}`,
    userRefreshSet:  (userId)    => `refreshTokens:${userId}`,

    // Analysis
    analysis:        (hash)      => `analysis:${hash}`,
    lockAnalysis:    (hash)      => `lock:analysis:${hash}`,

    // Quota
    quota:           (userId, monthKey) => `quota:${userId}:${monthKey}`,
};
