# Requirements Document

## Introduction

This feature replaces the existing JWT-based authentication system with PASETO (Platform-Agnostic Security Tokens) v4 local tokens. The migration preserves the existing credential flow (email/password login, OTP email verification, refresh token rotation, session management, RBAC) while gaining PASETO's stronger security guarantees: no algorithm confusion attacks, no `alg: none` exploits, and explicit versioned token types. The access token / refresh token split, Redis-backed blacklisting, brute-force lockout, and HttpOnly cookie delivery are all retained.

## Glossary

- **PASETO**: Platform-Agnostic Security Token — a token standard with versioned, opinionated cryptographic primitives that eliminates the algorithm-confusion vulnerabilities present in JWT.
- **PASETO v4 local**: Symmetric authenticated encryption using XChaCha20-Poly1305. The token payload is encrypted and authenticated with a single 256-bit key.
- **Token_Service**: The module (`src/utils/tokenHelper.js`) responsible for issuing and verifying PASETO tokens.
- **Auth_Service**: The module (`src/services/auth.service.js`) that orchestrates login, registration, refresh, and logout flows.
- **Auth_Middleware**: The Express middleware (`src/middleware/auth.middleware.js`) that validates the access token on every protected request.
- **Access_Token**: A short-lived PASETO v4 local token (15 minutes) carrying `userId`, `orgId`, `role`, and `jti`, delivered in the `Authorization: Bearer` header.
- **Refresh_Token**: A long-lived PASETO v4 local token (7 days) carrying `userId` and `jti`, delivered as an HttpOnly cookie.
- **JTI**: A unique token identifier (UUID v4) embedded in every token, used for blacklisting and session tracking in Redis.
- **Redis**: The in-memory store used for token blacklisting, session sets, OTP storage, brute-force counters, and lockout flags.
- **RBAC_Middleware**: The Express middleware (`src/middleware/rbac.middleware.js`) that enforces role-based access control using the `role` claim from the verified Access_Token.
- **Symmetric_Key**: A 256-bit secret key used by PASETO v4 local for both encryption and decryption. Replaces the JWT signing secrets.

---

## Requirements

### Requirement 1: PASETO Token Issuance

**User Story:** As a backend engineer, I want the system to issue PASETO v4 local tokens instead of JWTs, so that authentication tokens are free from algorithm-confusion vulnerabilities.

#### Acceptance Criteria

1. THE Token_Service SHALL issue Access_Tokens as PASETO v4 local tokens containing `userId`, `orgId`, `role`, `jti`, and `exp` claims.
2. THE Token_Service SHALL issue Refresh_Tokens as PASETO v4 local tokens containing `userId`, `jti`, and `exp` claims.
3. THE Token_Service SHALL embed a UUID v4 value as the `jti` claim in every issued token.
4. WHEN issuing an Access_Token, THE Token_Service SHALL set the token expiry to the value configured in `PASETO_ACCESS_EXPIRY` (default: 15 minutes).
5. WHEN issuing a Refresh_Token, THE Token_Service SHALL set the token expiry to the value configured in `PASETO_REFRESH_EXPIRY` (default: 7 days).
6. THE Token_Service SHALL use a 256-bit symmetric key sourced from `PASETO_LOCAL_SECRET` for all v4 local token operations.

---

### Requirement 2: PASETO Token Verification

**User Story:** As a backend engineer, I want the system to verify PASETO tokens on every protected request, so that only holders of valid, non-expired, non-revoked tokens can access protected resources.

#### Acceptance Criteria

1. WHEN a request arrives with an `Authorization: Bearer <token>` header, THE Auth_Middleware SHALL decrypt and verify the token using the PASETO v4 local symmetric key.
2. WHEN a token's `exp` claim is in the past, THE Auth_Middleware SHALL reject the request with HTTP 401 and error code `TOKEN_EXPIRED`.
3. WHEN a token's `jti` is present in the Redis blacklist, THE Auth_Middleware SHALL reject the request with HTTP 401 and error code `TOKEN_REVOKED`.
4. WHEN a token fails decryption or has an invalid structure, THE Auth_Middleware SHALL reject the request with HTTP 401 and error code `INVALID_TOKEN`.
5. WHEN a token passes all checks, THE Auth_Middleware SHALL attach `{ userId, orgId, role, jti, exp }` to `req.user` and call `next()`.
6. THE RBAC_Middleware SHALL continue to read `req.user.role` without modification, as the claim name is unchanged.

---

### Requirement 3: Login Flow

**User Story:** As a user, I want to log in with my email and password and receive PASETO tokens, so that I can authenticate with the API using the same credentials I already have.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Service SHALL issue a PASETO Access_Token and a PASETO Refresh_Token.
2. WHEN a user submits valid credentials, THE Auth_Service SHALL store the Refresh_Token JTI in Redis under `refreshToken:{jti}` with a TTL matching the token expiry.
3. WHEN a user submits valid credentials, THE Auth_Service SHALL add the JTI to the user's session set in Redis under `refreshTokens:{userId}`.
4. THE Auth_Service SHALL deliver the Refresh_Token as an HttpOnly, Secure, SameSite=Strict cookie.
5. THE Auth_Service SHALL return the Access_Token in the JSON response body.
6. THE brute-force lockout logic (5 failures → 15-minute lock) SHALL remain unchanged after the token format migration.

---

### Requirement 4: Token Refresh (Rotation)

**User Story:** As a user, I want my access token to be silently renewed using my refresh token, so that I stay logged in without re-entering my credentials.

#### Acceptance Criteria

1. WHEN a valid, non-blacklisted Refresh_Token is presented, THE Auth_Service SHALL issue a new PASETO Access_Token and a new PASETO Refresh_Token.
2. WHEN a Refresh_Token is consumed during rotation, THE Auth_Service SHALL atomically add the old JTI to the Redis blacklist with a TTL equal to the token's remaining lifetime.
3. WHEN a Refresh_Token JTI is already present in the Redis blacklist, THE Auth_Service SHALL reject the request with HTTP 401 and error code `TOKEN_ROTATED`.
4. WHEN a new Refresh_Token is issued, THE Auth_Service SHALL store its JTI in Redis and add it to the user's session set.
5. WHEN a Refresh_Token is expired or structurally invalid, THE Auth_Service SHALL reject the request with HTTP 401 and error code `UNAUTHORIZED`.

---

### Requirement 5: Logout

**User Story:** As a user, I want to log out and have my tokens immediately invalidated, so that a stolen token cannot be used after I sign out.

#### Acceptance Criteria

1. WHEN a user logs out, THE Auth_Service SHALL add the Access_Token JTI to the Redis blacklist with a TTL equal to the token's remaining lifetime.
2. WHEN a user logs out and a Refresh_Token cookie is present, THE Auth_Service SHALL add the Refresh_Token JTI to the Redis blacklist with a TTL equal to the token's remaining lifetime.
3. WHEN a user logs out, THE Auth_Service SHALL remove the Refresh_Token JTI from the user's session set in Redis.
4. WHEN a user logs out, THE Auth_Service SHALL clear the Refresh_Token HttpOnly cookie from the response.

---

### Requirement 6: Session Management

**User Story:** As a user, I want to view and revoke individual active sessions, so that I can remove access from devices I no longer use.

#### Acceptance Criteria

1. THE Auth_Service SHALL maintain a per-user set of active Refresh_Token JTIs in Redis under `refreshTokens:{userId}`.
2. WHEN a session revocation request is received for a specific JTI, THE Auth_Service SHALL verify the JTI belongs to the requesting user before revoking it.
3. WHEN a valid revocation request is received, THE Auth_Service SHALL add the JTI to the Redis blacklist and remove it from the user's session set.
4. WHEN a user requests revocation of all sessions, THE Auth_Service SHALL blacklist all JTIs in the user's session set and clear the set.
5. IF a JTI is not found in Redis, THEN THE Auth_Service SHALL return HTTP 404 with error code `NOT_FOUND`.

---

### Requirement 7: Environment Configuration

**User Story:** As a DevOps engineer, I want PASETO key configuration to be validated at startup, so that the application fails fast rather than running with missing or weak secrets.

#### Acceptance Criteria

1. THE Auth_Service SHALL read the PASETO symmetric key from the `PASETO_LOCAL_SECRET` environment variable.
2. WHEN `PASETO_LOCAL_SECRET` is absent or shorter than 32 characters, THE Auth_Service SHALL terminate the process at startup with a descriptive error message.
3. THE Auth_Service SHALL read token expiry durations from `PASETO_ACCESS_EXPIRY` and `PASETO_REFRESH_EXPIRY` environment variables, defaulting to `15m` and `7d` respectively.
4. WHERE the application runs in production, THE Auth_Service SHALL reject placeholder values for `PASETO_LOCAL_SECRET` (e.g. values containing "change-me" or "secret") and terminate the process.
5. THE Auth_Service SHALL continue to validate all other existing environment variables without modification.

---

### Requirement 8: Backward Compatibility and Migration

**User Story:** As a backend engineer, I want existing JWT tokens to be rejected cleanly after the migration, so that clients are forced to re-authenticate and receive PASETO tokens.

#### Acceptance Criteria

1. WHEN a request presents a JWT-formatted token after migration, THE Auth_Middleware SHALL reject it with HTTP 401 and error code `INVALID_TOKEN`.
2. THE Auth_Service SHALL remove all JWT-specific environment variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) from the validated env schema after migration.
3. THE Token_Service SHALL expose the same function signatures (`signAccessToken`, `signRefreshToken`, `verifyToken`, `decodeToken`, `getRemainingTTL`) so that call sites in Auth_Service and Auth_Middleware require no interface changes.
4. THE Auth_Service SHALL preserve all Redis key naming conventions (`blacklist:{jti}`, `refreshToken:{jti}`, `refreshTokens:{userId}`) so that existing session data structures are unchanged.

---

### Requirement 9: Token Decode Without Verification

**User Story:** As a backend engineer, I want to extract claims from a PASETO token for TTL calculation during logout, so that blacklist entries have accurate expiry times.

#### Acceptance Criteria

1. THE Token_Service SHALL provide a `decodeToken` function that decrypts and returns the payload of a PASETO v4 local token without performing expiry validation.
2. WHEN `decodeToken` is called with a structurally invalid token, THE Token_Service SHALL return `null` rather than throwing an exception.
3. THE `getRemainingTTL` function SHALL continue to accept a Unix epoch `exp` value and return the remaining seconds, unchanged from the current implementation.
