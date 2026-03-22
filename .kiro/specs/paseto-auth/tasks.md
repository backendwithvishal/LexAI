# Implementation Plan: paseto-auth

## Overview

Replace the `jsonwebtoken`-based token layer with PASETO v4 local (XChaCha20-Poly1305 symmetric encryption) using the `paseto` npm library. The migration is scoped to `tokenHelper.js`, `env.js`, and call-site variable renames in `auth.service.js`. No changes are needed in `auth.middleware.js` or `rbac.middleware.js`.

## Tasks

- [x] 1. Install the `paseto` npm package
  - Run `npm install paseto` to add the library to `dependencies`
  - Verify the package resolves correctly in the ESM project (`"type": "module"`)
  - _Requirements: 1.6_

- [x] 2. Rewrite `src/utils/tokenHelper.js` with PASETO v4 local
  - [x] 2.1 Implement `signAccessToken`, `signRefreshToken`, `verifyToken`, `decodeToken`, `getRemainingTTL`
    - Replace `jsonwebtoken` imports with `paseto` v4.local API
    - Derive a `KeyObject` from the raw `PASETO_LOCAL_SECRET` string using `V4.generateKey` or `createSecretKey`
    - `signAccessToken`: encrypt `{ userId, orgId, role, jti: uuidv4(), exp }` and return `{ token, jti }`
    - `signRefreshToken`: encrypt `{ userId, jti: uuidv4(), exp }` and return `{ token, jti }`
    - `verifyToken`: decrypt and validate; catch `PasetoExpiredError` → re-throw with `.name = 'TokenExpiredError'`; catch all other `PasetoError` → re-throw with `.name = 'JsonWebTokenError'`
    - `decodeToken`: decrypt WITHOUT expiry check; return `null` on any error (never throw)
    - `getRemainingTTL`: unchanged — `Math.max(exp - Math.floor(Date.now()/1000), 1)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.3, 9.1, 9.2, 9.3_

  - [ ]* 2.2 Write property test — Property 1: Token payload round-trip
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 1: Token payload round-trip`
    - Use `fc.record({ userId: fc.string(), orgId: fc.option(fc.string()), role: fc.constantFrom('admin','manager','user') })` for access token; `fc.record({ userId: fc.string() })` for refresh token
    - Assert all original fields plus UUID v4 `jti` and numeric `exp` are present after verify
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [ ]* 2.3 Write property test — Property 2: Token expiry is set correctly
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 2: Token expiry is set correctly`
    - Use `fc.constantFrom('15m', '7d', '1h')` as expiry input
    - Assert `exp` is within 5 seconds of `Math.floor(Date.now()/1000) + parsedSeconds(expiry)`
    - _Requirements: 1.4, 1.5_

  - [ ]* 2.4 Write property test — Property 3: Wrong key cannot verify token
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 3: Wrong key cannot verify token`
    - Use `fc.string({ minLength: 32 })` for two distinct secrets; filter out equal pairs
    - Assert `verifyToken` throws when called with a different key than the signing key
    - _Requirements: 1.6_

  - [ ]* 2.5 Write property test — Property 4: Invalid tokens are rejected
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 4: Invalid tokens are rejected`
    - Use `fc.string()` for arbitrary input strings (random strings, JWT strings, empty)
    - Assert `verifyToken` throws with `.name === 'JsonWebTokenError'`
    - _Requirements: 2.4, 8.1_

  - [ ]* 2.6 Write property test — Property 5: decodeToken never throws
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 5: decodeToken never throws`
    - Use `fc.string()` for arbitrary input
    - Assert `decodeToken` never throws and returns either an object or `null`
    - _Requirements: 9.1, 9.2_

  - [ ]* 2.7 Write property test — Property 6: getRemainingTTL returns positive minimum
    - File: `tests/unit/utils/tokenHelper.test.js`
    - `// Feature: paseto-auth, Property 6: getRemainingTTL returns positive minimum`
    - Use `fc.integer({ max: Math.floor(Date.now()/1000) - 1 })` for past exp values → assert returns `1`
    - Use `fc.integer({ min: Math.floor(Date.now()/1000) + 2 })` for future exp values → assert returns positive number
    - _Requirements: 9.3_

  - [ ]* 2.8 Write unit tests for `tokenHelper.js`
    - Access token contains all required claims (example)
    - Refresh token contains required claims (example)
    - Expired token throws `TokenExpiredError` (edge case — use a `0s` expiry)
    - JWT string is rejected with `JsonWebTokenError` (example — Req 8.1)
    - `decodeToken` on expired token returns payload without throwing (example — Req 9.1)
    - `decodeToken` on garbage returns `null` (example — Req 9.2)
    - _Requirements: 1.1, 1.2, 8.1, 9.1, 9.2_

- [x] 3. Checkpoint — Ensure all tokenHelper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update `src/config/env.js` — replace JWT vars with PASETO vars
  - [x] 4.1 Update Zod schema in `env.js`
    - Add `PASETO_LOCAL_SECRET: z.string().min(32, 'PASETO_LOCAL_SECRET must be at least 32 characters')`
    - Add `PASETO_ACCESS_EXPIRY: z.string().default('15m')`
    - Add `PASETO_REFRESH_EXPIRY: z.string().default('7d')`
    - Add `PASETO_REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().default(604800000)`
    - Remove `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `JWT_REFRESH_COOKIE_MAX_AGE_MS`
    - Update production placeholder check: replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with `PASETO_LOCAL_SECRET`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.2_

  - [ ]* 4.2 Write property test — Property 7: Env schema rejects weak or missing PASETO_LOCAL_SECRET
    - File: `tests/unit/config/env.test.js`
    - `// Feature: paseto-auth, Property 7: Env schema rejects weak or missing PASETO_LOCAL_SECRET`
    - Use `fc.string({ maxLength: 31 })` → assert schema parse fails
    - Assert absent key also fails
    - _Requirements: 7.2, 7.4_

  - [ ]* 4.3 Write unit tests for `env.js` PASETO schema
    - File: `tests/unit/config/env.test.js`
    - Missing `PASETO_LOCAL_SECRET` fails validation (Req 7.2)
    - Short `PASETO_LOCAL_SECRET` (< 32 chars) fails validation (Req 7.2)
    - Valid 32-char secret passes validation
    - JWT vars absent from schema (Req 8.2)
    - Default expiry values are applied (Req 7.3)
    - _Requirements: 7.2, 7.3, 8.2_

- [x] 5. Update call sites in `src/services/auth.service.js`
  - [x] 5.1 Rename env var references
    - `env.JWT_ACCESS_SECRET` → `env.PASETO_LOCAL_SECRET`
    - `env.JWT_REFRESH_SECRET` → `env.PASETO_LOCAL_SECRET`
    - `env.JWT_ACCESS_EXPIRY` → `env.PASETO_ACCESS_EXPIRY`
    - `env.JWT_REFRESH_EXPIRY` → `env.PASETO_REFRESH_EXPIRY`
    - `env.JWT_REFRESH_COOKIE_MAX_AGE_MS` → `env.PASETO_REFRESH_COOKIE_MAX_AGE_MS`
    - Rename import alias `verifyToken as verifyJwt` → `verifyToken` (update all call sites)
    - _Requirements: 7.1, 8.2, 8.3, 8.4_

- [~] 6. Update `src/middleware/auth.middleware.js` secret reference
  - Change `env.JWT_ACCESS_SECRET` → `env.PASETO_LOCAL_SECRET` in the `verifyToken` call
  - No other changes needed — error name mapping is handled in `tokenHelper.js`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.1 Write unit tests for `auth.middleware.js`
    - File: `tests/unit/middleware/auth.middleware.test.js`
    - Valid token → `req.user` populated, `next()` called (Req 2.5)
    - Blacklisted JTI → 401 `TOKEN_REVOKED` (Req 2.3)
    - Expired token → 401 `TOKEN_EXPIRED` (Req 2.2)
    - Invalid token string → 401 `INVALID_TOKEN` (Req 2.4)
    - Missing header → 401 `UNAUTHORIZED`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [~] 7. Update `.env` and `.env.example` files
  - Add `PASETO_LOCAL_SECRET=<min-32-char-value>` to `.env` and `.env.example`
  - Add `PASETO_ACCESS_EXPIRY=15m` and `PASETO_REFRESH_EXPIRY=7d` to both files
  - Add `PASETO_REFRESH_COOKIE_MAX_AGE_MS=604800000` to both files
  - Remove or comment out `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `JWT_REFRESH_COOKIE_MAX_AGE_MS`
  - _Requirements: 7.1, 7.2, 7.3, 8.2_

- [~] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `tokenHelper.js` is the only file with logic changes; all other files are call-site renames
- Property tests use `@fast-check/jest` which is already in `devDependencies`
- The `paseto` library must be installed before any implementation tasks run
