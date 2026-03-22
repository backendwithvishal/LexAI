/**
 * Unit tests for src/utils/tokenHelper.js
 *
 * Tests cover:
 *   - signAccessToken / signRefreshToken return { token, jti }
 *   - verifyToken decodes a valid token
 *   - verifyToken throws TokenExpiredError for expired tokens
 *   - verifyToken throws InvalidTokenError for invalid/non-PASETO strings
 *   - decodeToken returns payload without throwing on expired token
 *   - decodeToken returns null on garbage input
 *   - getRemainingTTL returns 1 for past exp values
 *   - getRemainingTTL returns positive number for future exp values
 */

import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  decodeToken,
  getRemainingTTL,
} from '../../../src/utils/tokenHelper.js';

// Secret must be at least 32 characters for PASETO key derivation
const SECRET = 'this-is-a-test-secret-that-is-at-least-32-chars';

const ACCESS_PAYLOAD = { userId: 'user123', orgId: 'org456', role: 'admin' };
const REFRESH_PAYLOAD = { userId: 'user123' };

describe('tokenHelper', () => {
  // ─── signAccessToken ────────────────────────────────────────────────────────

  describe('signAccessToken', () => {
    it('returns a token string and a jti', async () => {
      const { token, jti } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(typeof jti).toBe('string');
      expect(jti.length).toBeGreaterThan(0);
    });

    it('token starts with v3.local. prefix', async () => {
      const { token } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      expect(token.startsWith('v3.local.')).toBe(true);
    });

    it('jti is a UUID v4', async () => {
      const { jti } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      expect(jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('each call produces a unique jti', async () => {
      const { jti: jti1 } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      const { jti: jti2 } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      expect(jti1).not.toBe(jti2);
    });
  });

  // ─── signRefreshToken ───────────────────────────────────────────────────────

  describe('signRefreshToken', () => {
    it('returns a token string and a jti', async () => {
      const { token, jti } = await signRefreshToken(REFRESH_PAYLOAD, SECRET, '7d');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(typeof jti).toBe('string');
      expect(jti.length).toBeGreaterThan(0);
    });

    it('token starts with v3.local. prefix', async () => {
      const { token } = await signRefreshToken(REFRESH_PAYLOAD, SECRET, '7d');
      expect(token.startsWith('v3.local.')).toBe(true);
    });

    it('jti is a UUID v4', async () => {
      const { jti } = await signRefreshToken(REFRESH_PAYLOAD, SECRET, '7d');
      expect(jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  // ─── verifyToken ────────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('successfully decodes a valid access token', async () => {
      const { token, jti } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      const payload = await verifyToken(token, SECRET);

      expect(payload.userId).toBe(ACCESS_PAYLOAD.userId);
      expect(payload.orgId).toBe(ACCESS_PAYLOAD.orgId);
      expect(payload.role).toBe(ACCESS_PAYLOAD.role);
      expect(payload.jti).toBe(jti);
      expect(typeof payload.exp).toBe('number');
    });

    it('successfully decodes a valid refresh token', async () => {
      const { token, jti } = await signRefreshToken(REFRESH_PAYLOAD, SECRET, '7d');
      const payload = await verifyToken(token, SECRET);

      expect(payload.userId).toBe(REFRESH_PAYLOAD.userId);
      expect(payload.jti).toBe(jti);
      expect(typeof payload.exp).toBe('number');
    });

    it('throws TokenExpiredError for an expired token', async () => {
      // Sign with 1s expiry then wait for it to expire
      const { token } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '1s');
      // Wait 1100ms to ensure expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await expect(verifyToken(token, SECRET)).rejects.toMatchObject({
        name: 'TokenExpiredError',
      });
    }, 10000);

    it('throws InvalidTokenError for a non-PASETO token string', async () => {
      // A typical non-PASETO token string
      const nonPasetoString =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJ1c2VySWQiOiJ1c2VyMTIzIn0.' +
        'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await expect(verifyToken(nonPasetoString, SECRET)).rejects.toMatchObject({
        name: 'InvalidTokenError',
      });
    });

    it('throws InvalidTokenError for a random garbage string', async () => {
      await expect(verifyToken('not-a-token-at-all', SECRET)).rejects.toMatchObject({
        name: 'InvalidTokenError',
      });
    });

    it('throws InvalidTokenError for an empty string', async () => {
      await expect(verifyToken('', SECRET)).rejects.toMatchObject({
        name: 'InvalidTokenError',
      });
    });

    it('throws InvalidTokenError when verified with the wrong key', async () => {
      const { token } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      const wrongSecret = 'a-completely-different-secret-that-is-32-chars!!';

      await expect(verifyToken(token, wrongSecret)).rejects.toMatchObject({
        name: 'InvalidTokenError',
      });
    });
  });

  // ─── decodeToken ────────────────────────────────────────────────────────────

  describe('decodeToken', () => {
    it('returns payload without throwing on an expired token', async () => {
      const { token } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '1s');
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const payload = await decodeToken(token, SECRET);
      expect(payload).not.toBeNull();
      expect(payload.userId).toBe(ACCESS_PAYLOAD.userId);
    }, 10000);

    it('returns null on garbage input', async () => {
      const result = await decodeToken('garbage-input-not-a-token', SECRET);
      expect(result).toBeNull();
    });

    it('returns null on empty string', async () => {
      const result = await decodeToken('', SECRET);
      expect(result).toBeNull();
    });

    it('returns null on a non-PASETO token string', async () => {
      const nonPasetoString =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJ1c2VySWQiOiJ1c2VyMTIzIn0.' +
        'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = await decodeToken(nonPasetoString, SECRET);
      expect(result).toBeNull();
    });

    it('returns payload for a valid non-expired token', async () => {
      const { token, jti } = await signAccessToken(ACCESS_PAYLOAD, SECRET, '15m');
      const payload = await decodeToken(token, SECRET);

      expect(payload).not.toBeNull();
      expect(payload.userId).toBe(ACCESS_PAYLOAD.userId);
      expect(payload.jti).toBe(jti);
    });
  });

  // ─── getRemainingTTL ────────────────────────────────────────────────────────

  describe('getRemainingTTL', () => {
    it('returns 1 for a past exp value', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      expect(getRemainingTTL(pastExp)).toBe(1);
    });

    it('returns 1 for exp equal to current time', () => {
      const nowExp = Math.floor(Date.now() / 1000);
      expect(getRemainingTTL(nowExp)).toBe(1);
    });

    it('returns a positive number for a future exp value', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const ttl = getRemainingTTL(futureExp);
      expect(ttl).toBeGreaterThan(0);
      // Should be approximately 3600 (within a few seconds)
      expect(ttl).toBeLessThanOrEqual(3600);
      expect(ttl).toBeGreaterThanOrEqual(3595);
    });

    it('returns minimum of 1 even for very old exp', () => {
      const veryOldExp = 0; // Unix epoch start
      expect(getRemainingTTL(veryOldExp)).toBe(1);
    });
  });
});
