# LexAI — Complete Postman Collection

> **Base URL:** `http://localhost:3500/api/v1`
> **Local Port:** `3500` (set in `.env`)
> **API Version:** `v1` (set in `.env`)

---

## 📌 Postman Environment Variables

Create a Postman **Environment** with these variables:

| Variable           | Initial Value                  | Description                        |
|--------------------|--------------------------------|------------------------------------|
| `base_url`         | `http://localhost:3500/api/v1` | Base API URL                       |
| `access_token`     | *(set after login)*            | PASETO access token (Bearer)       |
| `admin_token`      | *(set after admin login)*      | PASETO access token for admin user |
| `refresh_token`    | *(auto-set via cookie)*        | Set as HttpOnly cookie by server   |
| `org_id`           | *(set after createOrg)*        | MongoDB ObjectId of your org       |
| `contract_id`      | *(set after upload)*           | MongoDB ObjectId of a contract     |
| `analysis_id`      | *(set after requestAnalysis)*  | MongoDB ObjectId of an analysis    |
| `user_id`          | *(set after login)*            | MongoDB ObjectId of your user      |
| `notification_id`  | *(from GET /notifications)*    | MongoDB ObjectId of a notification |
| `otp`              | *(from email / dev response)*  | 6-digit OTP for email verification |
| `reset_token`      | *(from forgot-password email)* | Hex token for password reset       |
| `session_jti`      | *(from GET /auth/sessions)*    | UUID JTI of a session to revoke    |
| `invite_token`     | *(from invitation email)*      | Invitation acceptance token        |

> 🔒 **Protected routes** require: `Authorization: Bearer {{access_token}}`
> 🍪 **Refresh token**: automatically stored as HttpOnly cookie named `refreshToken`

---

## 🏥 1. Health Check

No authentication required. Used by Docker / load balancers.

### GET — Health Check

```
GET http://localhost:3500/health
```

**Headers:** _(none)_

**Success Response (200):**
```json
{
  "status": "ok",
  "services": { "mongodb": "up", "redis": "up", "rabbitmq": "up" },
  "timestamp": "2026-03-03T17:50:00.000Z",
  "uptime": 3600
}
```

**Degraded Response (503):**
```json
{
  "status": "degraded",
  "services": { "mongodb": "up", "redis": "down", "rabbitmq": "up" },
  "timestamp": "2026-03-03T17:50:00.000Z",
  "uptime": 100
}
```

---

## 🔐 2. Auth — `/api/v1/auth`

> Rate-limited. Public endpoints do NOT need a token.

### POST — Register

```
POST {{base_url}}/auth/register
Content-Type: application/json
```

```json
{
  "name": "Vishal Sanam",
  "email": "vishal@example.com",
  "password": "SecurePass@123"
}
```

Password rules: min 8 chars, uppercase + lowercase + digit + special char (`@$!%*?&.,\-_#^()`).

**Success (201):**
```json
{
  "success": true,
  "message": "Registration successful. A 6-digit OTP has been sent to your email.",
  "data": { "userId": "65f1a2b3c4d5e6f7a8b9c0d1", "email": "vishal@example.com", "otp": "482910" }
}
```

> ⚠️ `otp` is only in the response in **development** mode.

---

### POST — Verify Email (OTP)

```
POST {{base_url}}/auth/verify-email
Content-Type: application/json
```

```json
{ "email": "vishal@example.com", "otp": "{{otp}}" }
```

OTP is 6 digits, expires in 10 minutes.

**Success (200):**
```json
{ "success": true, "message": "Email verified successfully. You can now log in." }
```

---

### POST — Resend Verification Email

```
POST {{base_url}}/auth/resend-verification-email
Content-Type: application/json
```

```json
{ "email": "vishal@example.com" }
```

**Success (200):**
```json
{ "success": true, "message": "If this email exists and is unverified, a new OTP has been sent." }
```

---

### POST — Login

```
POST {{base_url}}/auth/login
Content-Type: application/json
```

```json
{ "email": "vishal@example.com", "password": "SecurePass@123" }
```

**Success (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "v3.local.abcdef1234567890...",
    "user": { "id": "65f1a2b3c4d5e6f7a8b9c0d1", "name": "Vishal Sanam", "email": "vishal@example.com", "role": "admin" }
  }
}
```

> 🍪 Server sets `refreshToken` HttpOnly cookie automatically.
> Copy `data.accessToken` → `access_token`. Copy `data.user.id` → `user_id`.

---

### POST — Refresh Access Token

```
POST {{base_url}}/auth/refresh-token
```

No body needed — reads `refreshToken` cookie automatically.

**Success (200):**
```json
{ "success": true, "data": { "accessToken": "v3.local.abcdef1234567890..." } }
```

---

### POST — Forgot Password

```
POST {{base_url}}/auth/forgot-password
Content-Type: application/json
```

```json
{ "email": "vishal@example.com" }
```

**Success (200):**
```json
{ "success": true, "message": "If this email is registered, a password reset link has been sent." }
```

> Copy the token from the reset email link → `reset_token` env var.

---

### POST — Reset Password

```
POST {{base_url}}/auth/reset-password
Content-Type: application/json
```

```json
{ "token": "{{reset_token}}", "password": "NewSecurePass@456" }
```

Token is a 64-char hex string, expires in 1 hour.

**Success (200):**
```json
{ "success": true, "message": "Password reset successfully. You can now log in with your new password." }
```

---

### POST — Logout _(🔒 Protected)_

```
POST {{base_url}}/auth/logout
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "message": "Logged out successfully." }
```

> Blacklists both access and refresh tokens in Redis. Cookie is cleared.

---

### POST — Change Password _(🔒 Protected)_

```
POST {{base_url}}/auth/change-password
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "currentPassword": "SecurePass@123", "newPassword": "NewSecurePass@456" }
```

**Success (200):**
```json
{ "success": true, "message": "Password changed successfully." }
```

---

### GET — List Sessions _(🔒 Protected)_

```
GET {{base_url}}/auth/sessions
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": { "sessions": [{ "jti": "a1b2c3d4-e5f6-...", "createdAt": "2026-03-01T10:00:00Z" }] }
}
```

> Copy a `jti` → `session_jti` env var.

---

### DELETE — Revoke Session by JTI _(🔒 Protected)_

```
DELETE {{base_url}}/auth/sessions/{{session_jti}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "message": "Session revoked." }
```

---

### DELETE — Revoke All Sessions _(🔒 Protected)_

```
DELETE {{base_url}}/auth/sessions
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "message": "All sessions revoked." }
```

---

## 👤 3. Users — `/api/v1/users`

> All routes require `Authorization: Bearer {{access_token}}`

### GET — Get My Profile _(🔒 Protected)_

```
GET {{base_url}}/users/me
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "65f1a2b3c4d5e6f7a8b9c0d1", "name": "Vishal Sanam", "email": "vishal@example.com", "role": "admin", "isVerified": true }
  }
}
```

---

### PATCH — Update My Profile _(🔒 Protected)_

```
PATCH {{base_url}}/users/me
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "name": "Vishal S." }
```

Only `name` can be updated here. Email changes require a separate verification flow.

**Success (200):**
```json
{
  "success": true,
  "data": { "user": { "_id": "65f1a2b3c4d5e6f7a8b9c0d1", "name": "Vishal S.", "email": "vishal@example.com" } }
}
```

---

### GET — Get User by ID _(🔒 Protected — Admin Only)_

```
GET {{base_url}}/users/{{user_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "user": { ... } } }
```

---

## 🏢 4. Organizations — `/api/v1/orgs`

> All routes require `Authorization: Bearer {{access_token}}`

### POST — Create Organization _(🔒 Protected)_

```
POST {{base_url}}/orgs
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "name": "LexAI Legal Ltd" }
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "org": { "id": "65f1a2b3c4d5e6f7a8b9c0d2", "name": "LexAI Legal Ltd", "slug": "lexai-legal-ltd", "plan": "free", "memberCount": 1 }
  }
}
```

> Copy `data.org.id` → `org_id` env var.

---

### GET — Get Organization _(🔒 Protected)_

```
GET {{base_url}}/orgs/{{org_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "org": { ... } } }
```

---

### PATCH — Update Organization _(🔒 Protected — Admin/Manager)_

```
PATCH {{base_url}}/orgs/{{org_id}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "name": "LexAI Legal Group" }
```

**Success (200):**
```json
{ "success": true, "data": { "org": { ... } } }
```

---

### POST — Invite Member _(🔒 Protected — Admin/Manager)_

```
POST {{base_url}}/orgs/{{org_id}}/invite
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "email": "newmember@example.com", "role": "viewer" }
```

Roles: `"admin"`, `"manager"`, `"viewer"` (default: `"viewer"`).

**Success (200):**
```json
{
  "success": true,
  "message": "Invitation sent to newmember@example.com",
  "data": { "invitationId": "65f1a2b3c4d5e6f7a8b9c0d3", "expiresAt": "2026-03-10T17:00:00.000Z" }
}
```

---

### POST — Accept Invitation _(Public)_

```
POST {{base_url}}/orgs/{{org_id}}/invite/accept
Content-Type: application/json
```

```json
{ "token": "{{invite_token}}", "name": "New Member", "password": "Welcome@123" }
```

`name` and `password` required only if the user has no existing account.

**Success (200):**
```json
{ "success": true, "message": "Invitation accepted. Your account has been created.", "data": { ... } }
```

---

### PATCH — Change Member Role _(🔒 Protected — Admin only)_

```
PATCH {{base_url}}/orgs/{{org_id}}/members/{{user_id}}/role
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "role": "manager" }
```

**Success (200):**
```json
{ "success": true, "message": "Member role updated successfully." }
```

---

### DELETE — Remove Member _(🔒 Protected — Admin only)_

```
DELETE {{base_url}}/orgs/{{org_id}}/members/{{user_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "message": "Member removed from organization." }
```

---

## 📄 5. Contracts — `/api/v1/contracts`

> All routes require `Authorization: Bearer {{access_token}}`.
> `orgId` is resolved automatically from your token — you never need to send it.

**Quickstart order:** Create → List → Get → Update → Add Version → Compare → Audit → Delete

---

### POST — Create Contract _(🔒 Protected)_

Use **raw JSON** — no file upload needed. Just paste text directly.

```
POST {{base_url}}/contracts
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Minimal body (only 2 required fields):**
```json
{
  "title": "My NDA",
  "content": "This Non-Disclosure Agreement is made between Party A and Party B. Both parties agree to keep all shared information strictly confidential and not disclose it to any third party."
}
```

**Full body (all optional fields):**
```json
{
  "title": "My NDA",
  "content": "This Non-Disclosure Agreement is made between Party A and Party B. Both parties agree to keep all shared information strictly confidential and not disclose it to any third party.",
  "type": "NDA",
  "tags": ["legal", "2026"],
  "expiryDate": "2027-06-01",
  "jurisdiction": "India"
}
```

Field rules:
- `title` — required, 3–300 chars, no HTML tags
- `content` — required, min 50 chars (just paste any contract text)
- `type` — optional, one of: `NDA` `Vendor` `Employment` `SaaS` `Other` (default: `Other`)
- `tags` — optional array of strings
- `expiryDate` — optional, must be a future date in `YYYY-MM-DD` format
- `jurisdiction` — optional, free text (e.g. `India`, `United States`)

**Success (201):**
```json
{
  "success": true,
  "message": "Contract uploaded successfully",
  "data": {
    "contract": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d4",
      "title": "My NDA",
      "type": "NDA",
      "version": 1,
      "contentHash": "abc123def456..."
    }
  }
}
```

> Copy `data.contract.id` → `contract_id` env var.

---

### GET — List Contracts _(🔒 Protected)_

```
GET {{base_url}}/contracts
Authorization: Bearer {{access_token}}
```

No body needed. All query params are optional — just hit send to get your contracts.

**Optional query params:**

| Param    | Default     | Options                                                  |
|----------|-------------|----------------------------------------------------------|
| `page`   | 1           | any number                                               |
| `limit`  | 10          | 1–50                                                     |
| `type`   | _(all)_     | `NDA`, `Vendor`, `Employment`, `SaaS`, `Other`           |
| `sortBy` | `createdAt` | `createdAt`, `title`, `type`, `riskScore`, `expiryDate`  |
| `order`  | `desc`      | `asc`, `desc`                                            |
| `tag`    | _(none)_    | any tag string                                           |
| `search` | _(none)_    | search in title (max 100 chars)                          |

**Examples:**
```
GET {{base_url}}/contracts
GET {{base_url}}/contracts?type=NDA
GET {{base_url}}/contracts?search=confidential&limit=5
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "contracts": [{ "id": "...", "title": "My NDA", "type": "NDA", "version": 1 }],
    "meta": { "total": 3, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### GET — Get Contract by ID _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{access_token}}
```

No body. Just set `contract_id` in your env vars.

**Success (200):**
```json
{ "success": true, "data": { "contract": { "id": "...", "title": "My NDA", "content": "...", "type": "NDA" } } }
```

---

### PATCH — Update Contract _(🔒 Protected)_

Send only the fields you want to change. At least one field required.

```
PATCH {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "title": "Updated NDA" }
```

Other updatable fields (all optional, mix and match):
```json
{
  "title": "Updated NDA",
  "type": "Vendor",
  "tags": ["updated", "2026"],
  "alertDays": [30, 7],
  "expiryDate": "2027-12-01"
}
```

- `alertDays` — array of integers (days before expiry to send alerts, e.g. `[90, 30, 7]`)

**Success (200):**
```json
{ "success": true, "data": { "contract": { "id": "...", "title": "Updated NDA" } } }
```

---

### POST — Add New Version _(🔒 Protected)_

Upload revised contract text as a new version. Only `content` is required.

```
POST {{base_url}}/contracts/{{contract_id}}/versions
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{
  "content": "This Non-Disclosure Agreement (revised) is made between Party A and Party B. Updated confidentiality terms apply from the date of signing.",
  "changeNote": "Updated confidentiality clause"
}
```

- `content` — required, min 50 chars
- `changeNote` — optional, describe what changed (max 500 chars)

**Success (201):**
```json
{ "success": true, "data": { "version": 2 } }
```

---

### GET — List Versions _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}/versions
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "versions": [{ "version": 1 }, { "version": 2 }] } }
```

---

### POST — Compare Two Versions _(🔒 Protected)_

```
POST {{base_url}}/contracts/{{contract_id}}/compare
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "versionA": 1, "versionB": 2 }
```

- Both values must be different integers ≥ 1
- AI explanation arrives via WebSocket (`diff:complete` event) — not in this response

**Success (202):**
```json
{
  "success": true,
  "message": "Version comparison queued. You will be notified via WebSocket when complete.",
  "data": { "diff": "..." }
}
```

---

### GET — Audit Trail _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}/audit
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "logs": [{ "action": "contract.created", "userId": "...", "timestamp": "2026-03-01T10:00:00Z" }]
  }
}
```

---

### DELETE — Delete Contract _(🔒 Protected — Admin/Manager only)_

```
DELETE {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{access_token}}
```

No body needed.

**Success (200):**
```json
{ "success": true, "message": "Contract deleted successfully." }
```

---

## 🤖 6. Analyses — `/api/v1/analyses`

> All routes require `Authorization: Bearer {{access_token}}` + org membership.

### POST — Request AI Analysis _(🔒 Protected)_

```
POST {{base_url}}/analyses
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{ "contractId": "{{contract_id}}", "version": 1 }
```

`version` is optional — omit to analyse the latest version.

**Success — Cached (200):**
```json
{ "success": true, "message": "Analysis result retrieved from cache.", "data": { "cached": true, "analysis": { ... } } }
```

**Success — Queued (202):**
```json
{
  "success": true,
  "message": "Analysis job queued. You will receive a WebSocket notification when complete.",
  "data": { "analysisId": "65f1a2b3c4d5e6f7a8b9c0d5", "status": "pending", "estimatedSeconds": 30 }
}
```

> Copy `data.analysisId` → `analysis_id` env var.

---

### GET — Get Analysis by ID _(🔒 Protected)_

```
GET {{base_url}}/analyses/{{analysis_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d5",
      "contractId": "...",
      "status": "completed",
      "riskScore": 7.2,
      "summary": "This NDA contains standard confidentiality clauses...",
      "flags": ["missing_penalty_clause", "jurisdiction_mismatch"]
    }
  }
}
```

---

### GET — Get All Analyses for a Contract _(🔒 Protected)_

```
GET {{base_url}}/analyses/contract/{{contract_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "analyses": [ { ... }, { ... } ] } }
```

---

## 🔔 7. Notifications — `/api/v1/notifications`

> All routes require `Authorization: Bearer {{access_token}}`

### GET — List Notifications _(🔒 Protected)_

```
GET {{base_url}}/notifications
Authorization: Bearer {{access_token}}
```

**Query Parameters (optional):**

| Param   | Default | Description                     |
|---------|---------|---------------------------------|
| `page`  | 1       |                                 |
| `limit` | 20      |                                 |
| `read`  | _(all)_ | `true` or `false` to filter     |

**Example:** `GET {{base_url}}/notifications?read=false&page=1&limit=20`

**Success (200):**
```json
{
  "success": true,
  "notifications": [ { ... } ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET — Get Unread Count _(🔒 Protected)_

```
GET {{base_url}}/notifications/unread-count
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "unreadCount": 3 }
```

---

### GET — User Notifications _(🔒 Protected)_

```
GET {{base_url}}/notifications/user
Authorization: Bearer {{access_token}}
```

Returns notifications scoped to the authenticated user (not org-scoped).

**Query Parameters (optional):**

| Param   | Default | Description                           |
|---------|---------|---------------------------------------|
| `page`  | 1       |                                       |
| `limit` | 20      |                                       |
| `read`  | _(all)_ | `true` or `false`                     |
| `type`  | _(all)_ | Filter by type (e.g. `analysis_done`) |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [{ "id": "...", "type": "analysis_done", "message": "...", "read": false, "createdAt": "..." }],
    "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

---

### PATCH — Mark All as Read _(🔒 Protected)_

```
PATCH {{base_url}}/notifications/read-all
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "modifiedCount": 3 }
```

---

### PATCH — Mark One as Read _(🔒 Protected)_

```
PATCH {{base_url}}/notifications/{{notification_id}}/read
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "notification": { "_id": "...", "read": true, "readAt": "2026-03-03T17:00:00Z" } }
```

---

### DELETE — Delete Notification _(🔒 Protected)_

```
DELETE {{base_url}}/notifications/{{notification_id}}
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "message": "Notification deleted." }
```

---

## 🌐 8. Enrichment — `/api/v1/enrichment`

> All routes require `Authorization: Bearer {{access_token}}`
> These are non-critical — they degrade gracefully if an external API is unavailable.

### GET — Country Info

```
GET {{base_url}}/enrichment/country/:name
Authorization: Bearer {{access_token}}
```

**Example:** `GET {{base_url}}/enrichment/country/India`

**Success (200):**
```json
{ "success": true, "data": { "country": { "name": "India", "capital": "New Delhi", "region": "Asia", "currencies": { ... }, "languages": { ... } } } }
```

---

### GET — World Time by Timezone

```
GET {{base_url}}/enrichment/time/:timezone
Authorization: Bearer {{access_token}}
```

**Example:** `GET {{base_url}}/enrichment/time/Asia/Kolkata`

Timezone names support slashes (e.g. `America/New_York`, `Europe/London`).

**Success (200):**
```json
{ "success": true, "data": { "time": { "timezone": "Asia/Kolkata", "datetime": "2026-04-08T15:30:00+05:30", "utc_offset": "+05:30" } } }
```

---

### GET — Check Holiday on a Date

```
GET {{base_url}}/enrichment/holidays?country=IN&date=2026-01-26
Authorization: Bearer {{access_token}}
```

**Query Parameters:**

| Param     | Required | Description                          |
|-----------|----------|--------------------------------------|
| `country` | Yes      | 2-letter ISO code (e.g. `US`, `IN`)  |
| `date`    | Yes      | Date in `YYYY-MM-DD` format          |

**Success (200):**
```json
{ "success": true, "data": { "holiday": { "isHoliday": true, "holidays": [{ "name": "Republic Day", "date": "2026-01-26" }] } } }
```

---

### GET — All Public Holidays for a Country/Year

```
GET {{base_url}}/enrichment/holidays/:country/:year
Authorization: Bearer {{access_token}}
```

**Example:** `GET {{base_url}}/enrichment/holidays/IN/2026`

**Success (200):**
```json
{ "success": true, "data": { "holidays": [ { "date": "2026-01-26", "name": "Republic Day" }, ... ], "country": "IN", "year": 2026 } }
```

---

### GET — IP Geolocation

```
GET {{base_url}}/enrichment/ip/:ip
Authorization: Bearer {{access_token}}
```

**Example:** `GET {{base_url}}/enrichment/ip/8.8.8.8`

Useful for flagging logins from unexpected locations.

**Success (200):**
```json
{ "success": true, "data": { "ipInfo": { "ip": "8.8.8.8", "city": "Mountain View", "region": "California", "country": "US", "org": "AS15169 Google LLC" } } }
```

---

### GET — Validate Email

```
GET {{base_url}}/enrichment/email/validate?email=user@example.com
Authorization: Bearer {{access_token}}
```

Runs syntax + MX record check (EVA) and disposable email detection (Disify) in parallel.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "validation": { "valid": true, "disposable": false, "mx": true },
    "disposable": { "isDisposable": false }
  }
}
```

---

### GET — Email Reputation

```
GET {{base_url}}/enrichment/email/reputation?email=user@example.com
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "email": "user@example.com", "reputation": { "risk": "low", "suspicious": false } } }
```

---

### GET — Email Breach Check (HIBP)

```
GET {{base_url}}/enrichment/email/breaches?email=user@example.com
Authorization: Bearer {{access_token}}
```

Requires `HIBP_API_KEY` in `.env`. Degrades gracefully if not configured.

**Success (200):**
```json
{ "success": true, "data": { "email": "user@example.com", "breaches": { "count": 2, "breaches": [{ "Name": "Adobe", "BreachDate": "2013-10-04" }] } } }
```

---

### GET — Exchange Rate (Single Pair)

```
GET {{base_url}}/enrichment/currency/rate?from=USD&to=EUR
Authorization: Bearer {{access_token}}
```

**Query Parameters:**

| Param  | Required | Description              |
|--------|----------|--------------------------|
| `from` | Yes      | 3-letter ISO code (USD)  |
| `to`   | Yes      | 3-letter ISO code (EUR)  |

**Success (200):**
```json
{ "success": true, "data": { "exchange": { "base": "USD", "target": "EUR", "rate": 0.9215, "date": "2026-04-08" } } }
```

---

### GET — Exchange Rates (Multiple Targets)

```
GET {{base_url}}/enrichment/currency/rates?base=USD&targets=EUR,GBP,JPY
Authorization: Bearer {{access_token}}
```

**Query Parameters:**

| Param     | Required | Description                          |
|-----------|----------|--------------------------------------|
| `base`    | Yes      | 3-letter ISO base currency           |
| `targets` | No       | Comma-separated target currency list |

**Success (200):**
```json
{ "success": true, "data": { "exchange": { "base": "USD", "date": "2026-04-08", "rates": { "EUR": 0.9215, "GBP": 0.7891, "JPY": 151.23 } } } }
```

---

## 🛡️ 9. Admin — `/api/v1/admin`

> All routes require `Authorization: Bearer {{admin_token}}` (admin role only).
> Rate limited: 5 requests / 15 min.

### GET — Platform Stats _(🔒 Admin only)_

```
GET {{base_url}}/admin/stats
Authorization: Bearer {{admin_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 120,
      "totalOrgs": 35,
      "totalContracts": 480,
      "totalAnalyses": 310,
      "analysesLast30Days": 45,
      "averageRiskScore": 6.3,
      "queueDepth": 2
    }
  }
}
```

---

### GET — Queue Status _(🔒 Admin only)_

```
GET {{base_url}}/admin/queue/status
Authorization: Bearer {{admin_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "queue": {
      "name": "lexai.analysis.queue",
      "messageCount": 3,
      "consumerCount": 1,
      "dlxMessageCount": 0
    }
  }
}
```

`dlxMessageCount` = jobs that failed all retries (dead letter queue).

---

### GET — List All Users _(🔒 Admin only)_

```
GET {{base_url}}/admin/users
Authorization: Bearer {{admin_token}}
```

**Query Parameters (optional):**

| Param   | Default | Description |
|---------|---------|-------------|
| `page`  | 1       |             |
| `limit` | 20      |             |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "users": [ { "_id": "...", "name": "...", "email": "...", "role": "viewer", "isActive": true } ],
    "meta": { "total": 120, "page": 1, "limit": 20, "totalPages": 6 }
  }
}
```

---

### POST — Create User (No OTP) _(🔒 Admin only)_

```
POST {{base_url}}/admin/users
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

```json
{ "name": "New User", "email": "newuser@example.com", "password": "SecurePass@123", "role": "viewer" }
```

Creates a pre-verified user — skips the OTP email flow. Roles: `admin`, `manager`, `viewer`.

**Success (201):**
```json
{ "success": true, "message": "User created successfully.", "data": { "user": { ... } } }
```

---

### PATCH — Update User _(🔒 Admin only)_

```
PATCH {{base_url}}/admin/users/{{user_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

```json
{ "role": "manager", "isActive": true, "name": "Updated Name" }
```

Allowed fields: `name`, `role`, `isActive`. At least one required.

**Success (200):**
```json
{ "success": true, "message": "User updated successfully.", "data": { "user": { ... } } }
```

---

### DELETE — Deactivate User _(🔒 Admin only)_

```
DELETE {{base_url}}/admin/users/{{user_id}}
Authorization: Bearer {{admin_token}}
```

Soft-deactivates the user (sets `isActive: false`). Cannot deactivate your own account.

**Success (200):**
```json
{ "success": true, "message": "User deactivated successfully." }
```

---

### GET — Global Audit Logs _(🔒 Admin only)_

```
GET {{base_url}}/admin/audit-logs
Authorization: Bearer {{admin_token}}
```

**Query Parameters (optional):**

| Param   | Default | Description |
|---------|---------|-------------|
| `page`  | 1       |             |
| `limit` | 20      |             |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      { "action": "contract.deleted", "userId": "...", "orgId": "...", "timestamp": "2026-04-08T10:00:00Z", "meta": { ... } }
    ],
    "meta": { "total": 500, "page": 1, "limit": 20, "totalPages": 25 }
  }
}
```

---

## 🌍 10. Public APIs (from public-apis/public-apis)

> These are free public APIs relevant to LexAI. All require `Authorization: Bearer {{access_token}}` on the LexAI enrichment proxy, or can be called directly using the URLs below.
> No calendar APIs are included.

---

### 🔐 Security APIs

---

#### GreyNoise — IP Threat Intelligence

Check if an IP address is a known internet scanner, bot, or malicious actor. Useful for flagging suspicious login IPs.

```
GET https://api.greynoise.io/v3/community/{{ip}}
Key: none required for community tier
```

**Example:** `GET https://api.greynoise.io/v3/community/8.8.8.8`

**Success (200):**
```json
{
  "ip": "8.8.8.8",
  "noise": false,
  "riot": true,
  "classification": "benign",
  "name": "Google Public DNS",
  "link": "https://viz.greynoise.io/ip/8.8.8.8",
  "last_seen": "2026-04-08",
  "message": "This IP is commonly included in blocklists."
}
```

- `noise: true` = actively scanning the internet (suspicious)
- `riot: true` = known benign service (Google, Cloudflare, etc.)
- Auth: No key needed for community endpoint (1000 req/day)
- Docs: [https://docs.greynoise.io](https://docs.greynoise.io)

---

#### HaveIBeenPwned — Email Breach Check *(already in Section 8)*

Already integrated at `GET {{base_url}}/enrichment/email/breaches?email=...`
Requires `HIBP_API_KEY` in `.env`.

---

#### Shodan — Internet Device Search

Search for internet-connected devices, open ports, and vulnerabilities by IP. Useful for security audits.

```
GET https://api.shodan.io/shodan/host/{{ip}}?key={{shodan_api_key}}
```

**Example:** `GET https://api.shodan.io/shodan/host/8.8.8.8?key=YOUR_KEY`

**Success (200):**
```json
{
  "ip_str": "8.8.8.8",
  "org": "Google LLC",
  "country_name": "United States",
  "ports": [53, 443],
  "vulns": [],
  "last_update": "2026-04-08T00:00:00.000Z"
}
```

- Auth: `apiKey` — get free key at [https://account.shodan.io](https://account.shodan.io)
- Free tier: 1 query credit/scan
- Add `SHODAN_API_KEY` to your `.env`
- Docs: [https://developer.shodan.io/api](https://developer.shodan.io/api)

---

### 📧 Email APIs

---

#### Hunter — Email Finder & Verifier

Find professional email addresses by domain or verify if an email is deliverable. Useful for org member invitations.

```
GET https://api.hunter.io/v2/email-verifier?email={{email}}&api_key={{hunter_api_key}}
```

**Example:** `GET https://api.hunter.io/v2/email-verifier?email=user@example.com&api_key=YOUR_KEY`

**Success (200):**
```json
{
  "data": {
    "status": "valid",
    "result": "deliverable",
    "score": 92,
    "email": "user@example.com",
    "regexp": true,
    "gibberish": false,
    "disposable": false,
    "webmail": false,
    "mx_records": true,
    "smtp_server": true,
    "smtp_check": true
  }
}
```

- Auth: `apiKey` — free tier: 25 verifications/month at [https://hunter.io](https://hunter.io)
- Add `HUNTER_API_KEY` to your `.env`
- Docs: [https://hunter.io/api-documentation](https://hunter.io/api-documentation)

---

#### mailboxlayer — Email Validation

Validate email addresses for syntax, MX records, SMTP, and disposable detection.

```
GET https://apilayer.net/api/check?access_key={{mailboxlayer_key}}&email={{email}}
```

**Example:** `GET https://apilayer.net/api/check?access_key=YOUR_KEY&email=user@example.com`

**Success (200):**
```json
{
  "email": "user@example.com",
  "did_you_mean": "",
  "user": "user",
  "domain": "example.com",
  "format_valid": true,
  "mx_found": true,
  "smtp_check": true,
  "catch_all": false,
  "role": false,
  "disposable": false,
  "free": false,
  "score": 0.96
}
```

- Auth: `apiKey` — free tier: 100 requests/month at [https://mailboxlayer.com](https://mailboxlayer.com)
- Add `MAILBOXLAYER_API_KEY` to your `.env`
- Docs: [https://mailboxlayer.com/documentation](https://mailboxlayer.com/documentation)

---

### 💱 Currency Exchange APIs

---

#### ExchangeRate-API — Free Currency Conversion *(no key required)*

Free currency conversion with 1500+ req/month on free plan. Alternative to Frankfurter (already in Section 8).

```
GET https://open.er-api.com/v6/latest/{{base_currency}}
```

**Example:** `GET https://open.er-api.com/v6/latest/USD`

**Success (200):**
```json
{
  "result": "success",
  "base_code": "USD",
  "time_last_update_utc": "Wed, 08 Apr 2026 00:00:00 +0000",
  "rates": {
    "EUR": 0.9215,
    "GBP": 0.7891,
    "INR": 83.45,
    "JPY": 151.23
  }
}
```

- Auth: None required for free tier
- Free tier: 1500 requests/month
- Docs: [https://www.exchangerate-api.com/docs/free](https://www.exchangerate-api.com/docs/free)

---

#### Frankfurter — ECB Exchange Rates *(already in Section 8)*

Already integrated at `GET {{base_url}}/enrichment/currency/rate` and `/rates`. No key needed.

---

### 🌐 Geocoding / IP APIs

---

#### ipgeolocation — IP Geolocation

Detailed IP geolocation with timezone, currency, and security flags. Free plan: 30k requests/month.

```
GET https://api.ipgeolocation.io/ipgeo?apiKey={{ipgeo_key}}&ip={{ip}}
```

**Example:** `GET https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_KEY&ip=8.8.8.8`

**Success (200):**
```json
{
  "ip": "8.8.8.8",
  "country_name": "United States",
  "country_code2": "US",
  "city": "Mountain View",
  "time_zone": { "name": "America/Los_Angeles", "offset": -7 },
  "currency": { "code": "USD", "name": "US Dollar" },
  "security": { "threat_score": 0, "is_tor": false, "is_proxy": false, "is_bot": false }
}
```

- Auth: `apiKey` — free tier: 30k req/month at [https://ipgeolocation.io](https://ipgeolocation.io)
- Add `IPGEO_API_KEY` to your `.env`
- Docs: [https://ipgeolocation.io/documentation](https://ipgeolocation.io/documentation)

---

### 🧠 Text Analysis APIs

---

#### Google Cloud Natural Language — Text Analysis

Sentiment analysis, entity extraction, and syntax analysis on contract text. Useful for automated contract summarization.

```
POST https://language.googleapis.com/v1/documents:analyzeEntities?key={{google_nlp_key}}
Content-Type: application/json
```

```json
{
  "document": {
    "type": "PLAIN_TEXT",
    "content": "This Non-Disclosure Agreement is between Party A and Party B, governed under the laws of India."
  },
  "encodingType": "UTF8"
}
```

**Success (200):**
```json
{
  "entities": [
    { "name": "Party A", "type": "PERSON", "salience": 0.45 },
    { "name": "Party B", "type": "PERSON", "salience": 0.40 },
    { "name": "India", "type": "LOCATION", "salience": 0.15 }
  ],
  "language": "en"
}
```

- Auth: `apiKey` — free tier: 5000 units/month at [https://cloud.google.com/natural-language](https://cloud.google.com/natural-language)
- Add `GOOGLE_NLP_API_KEY` to your `.env`
- Docs: [https://cloud.google.com/natural-language/docs/reference/rest](https://cloud.google.com/natural-language/docs/reference/rest)

---

#### Cloudmersive NLP — Natural Language Processing

Text analysis including sentiment, entity detection, and language identification. Free tier: 800 calls/month.

```
POST https://api.cloudmersive.com/nlp-v2/analytics/sentiment
Content-Type: application/json
Apikey: {{cloudmersive_key}}
```

```json
{
  "TextToAnalyze": "This contract contains unfair penalty clauses and ambiguous jurisdiction terms."
}
```

**Success (200):**
```json
{
  "Successful": true,
  "SentimentClassificationResult": "Negative",
  "SentimentScoreResult": -0.72,
  "SentenceCount": 1
}
```

- Auth: `apiKey` — free tier: 800 calls/month at [https://cloudmersive.com](https://cloudmersive.com)
- Add `CLOUDMERSIVE_API_KEY` to your `.env`
- Docs: [https://cloudmersive.com/nlp-api](https://cloudmersive.com/nlp-api)

---

### ✅ Data Validation APIs

---

#### VATlayer — VAT Number Validation

Validate EU VAT numbers for business contracts. Useful when contracts involve EU companies.

```
GET https://apilayer.net/api/validate?access_key={{vatlayer_key}}&vat_number={{vat_number}}
```

**Example:** `GET https://apilayer.net/api/validate?access_key=YOUR_KEY&vat_number=GB123456789`

**Success (200):**
```json
{
  "valid": true,
  "country_code": "GB",
  "vat_number": "123456789",
  "company_name": "Example Ltd",
  "company_address": "123 Business St, London, UK"
}
```

- Auth: `apiKey` — free tier: 100 requests/month at [https://vatlayer.com](https://vatlayer.com)
- Add `VATLAYER_API_KEY` to your `.env`
- Docs: [https://vatlayer.com/documentation](https://vatlayer.com/documentation)

---

#### PurgoMalum — Profanity / Content Filter *(no key required)*

Check contract text for profanity or inappropriate content before storing. No API key needed.

```
GET https://www.purgomalum.com/service/json?text={{text_to_check}}
```

**Example:** `GET https://www.purgomalum.com/service/json?text=This is a clean contract`

**Success (200):**
```json
{ "result": "This is a clean contract" }
```

If profanity is found, the words are replaced with `****` in the result.

- Auth: None required
- Free: Unlimited requests
- Docs: [https://www.purgomalum.com](https://www.purgomalum.com)

---

### 📋 New Environment Variables for Public APIs

Add these to your `.env` as needed (all optional — features degrade gracefully if not set):

| Variable              | API             | Where to get it                              |
|-----------------------|-----------------|----------------------------------------------|
| `SHODAN_API_KEY`      | Shodan          | https://account.shodan.io                    |
| `HUNTER_API_KEY`      | Hunter          | https://hunter.io/users/sign_up              |
| `MAILBOXLAYER_API_KEY`| mailboxlayer    | https://mailboxlayer.com/product             |
| `IPGEO_API_KEY`       | ipgeolocation   | https://ipgeolocation.io/signup.html         |
| `GOOGLE_NLP_API_KEY`  | Google Cloud NLP| https://console.cloud.google.com             |
| `CLOUDMERSIVE_API_KEY`| Cloudmersive    | https://account.cloudmersive.com/signup      |
| `VATLAYER_API_KEY`    | VATlayer        | https://vatlayer.com/product                 |

---

## 🔑 Environment Variables Reference

These are the only env vars relevant to this project. Set them in your `.env` file.

| Variable                    | Required | Description                                          |
|-----------------------------|----------|------------------------------------------------------|
| `NODE_ENV`                  | Yes      | `development` or `production`                        |
| `PORT`                      | Yes      | Server port (default `3500`)                         |
| `API_VERSION`               | Yes      | API version prefix (default `v1`)                    |
| `MONGO_URI`                 | Yes      | MongoDB connection string                            |
| `REDIS_HOST`                | Yes      | Redis host                                           |
| `REDIS_PORT`                | Yes      | Redis port (default `6379`)                          |
| `REDIS_PASSWORD`            | No       | Redis password (leave empty for local)               |
| `RABBITMQ_URL`              | Yes      | RabbitMQ AMQP URL                                    |
| `PASETO_LOCAL_SECRET`       | Yes      | Min 32-char secret for PASETO token signing          |
| `PASETO_ACCESS_EXPIRY`      | Yes      | Access token TTL (e.g. `15m`)                        |
| `PASETO_REFRESH_EXPIRY`     | Yes      | Refresh token TTL (e.g. `7d`)                        |
| `OPENROUTER_API_KEY`        | Yes      | OpenRouter key for AI analysis (`sk-or-v1-...`)      |
| `OPENROUTER_BASE_URL`       | Yes      | `https://openrouter.ai/api/v1`                       |
| `AI_PRIMARY_MODEL`          | Yes      | Primary AI model slug                                |
| `AI_FALLBACK_MODEL`         | Yes      | Fallback AI model slug                               |
| `MAX_FILE_SIZE_MB`          | Yes      | Max contract upload size in MB (default `5`)         |
| `ALLOWED_MIME_TYPES`        | Yes      | Comma-separated allowed MIME types                   |
| `ALLOWED_ORIGINS`           | Yes      | Comma-separated CORS origins                         |
| `SMTP_HOST`                 | Yes      | SMTP server host                                     |
| `SMTP_PORT`                 | Yes      | SMTP port (587 for TLS)                              |
| `SMTP_USER`                 | Yes      | SMTP username                                        |
| `SMTP_PASS`                 | Yes      | SMTP password                                        |
| `EMAIL_FROM`                | Yes      | Sender address (e.g. `noreply@lexai.io`)             |
| `IPINFO_TOKEN`              | No       | IPinfo token for higher rate limits (50k/mo free)    |
| `HIBP_API_KEY`              | No       | HaveIBeenPwned API key for breach checks             |
| `ADMIN_EMAIL`               | No       | Bootstrap admin email (seed script only)             |
| `ADMIN_PASSWORD`            | No       | Bootstrap admin password (seed script only)          |
