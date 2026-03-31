# LexAI — Complete Postman Collection

> **Base URL:** `http://localhost:3500/api/v1`
> **Local Port:** `3500` (set in `.env`)
> **API Version:** `v1` (set in `.env`)

---

## 📌 Postman Environment Variables

Create a Postman **Environment** with these variables:

| Variable          | Initial Value                      | Description                         |
|-------------------|------------------------------------|-------------------------------------|
| `base_url`        | `http://localhost:3500/api/v1`     | Base API URL                        |
| `access_token`    | *(set after login)*                | PASETO access token (Bearer)        |
| `admin_token`     | *(set after admin login)*          | PASETO access token for admin user  |
| `refresh_token`   | *(auto-set via cookie)*            | Set as HttpOnly cookie by server    |
| `org_id`          | *(set after createOrg)*            | MongoDB ObjectId of your org        |
| `contract_id`     | *(set after upload)*               | MongoDB ObjectId of a contract      |
| `analysis_id`     | *(set after requestAnalysis)*      | MongoDB ObjectId of an analysis     |
| `user_id`         | *(set after login)*                | MongoDB ObjectId of your user       |
| `notification_id` | *(from GET /notifications)*        | MongoDB ObjectId of a notification  |
| `otp`             | *(from email / dev response)*      | 6-digit OTP for email verification  |
| `reset_token`     | *(from forgot-password email)*     | Hex token for password reset        |
| `session_jti`     | *(from GET /auth/sessions)*        | UUID JTI of a session to revoke     |
| `invite_token`    | *(from invitation email)*          | Invitation acceptance token         |

> 🔒 **Protected routes** require: `Authorization: Bearer {{access_token}}`
> 🍪 **Refresh token**: automatically stored as HttpOnly cookie named `refreshToken`

---

## 🏥 1. Health Check ✅

No authentication required. Used by Docker / load balancers.

---

### GET — Health Check

```
GET http://localhost:3500/health
```

**Headers:** _(none)_

**Success Response (200 — all healthy):**
```json
{
  "status": "ok",
  "services": {
    "mongodb": "up",
    "redis": "up",
    "rabbitmq": "up"
  },
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

## 🔐 2. Auth — `/api/v1/auth` ✅

> Rate-limited. Public endpoints do NOT need a token.

---

### POST — Register

```
POST {{base_url}}/auth/register
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "Vishal Sanam",
  "email": "vishal@example.com",
  "password": "SecurePass@123"
}
```

**Password rules:** min 8 chars, must contain uppercase, lowercase, digit, special char (`@$!%*?&.,\-_#^()`).

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. A 6-digit OTP has been sent to your email.",
  "data": {
    "userId": "65f1a2b3c4d5e6f7a8b9c0d1",
    "email": "vishal@example.com",
    "otp": "482910"
  }
}
```

> ⚠️ `otp` is only included in the response in **development** mode. In production it is only sent by email.

---

### POST — Verify Email (OTP)

```
POST {{base_url}}/auth/verify-email
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "vishal@example.com",
  "otp": "{{otp}}"
}
```

OTP is exactly 6 digits. Expires in 10 minutes.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in."
}
```

---

### POST — Resend Verification Email

```
POST {{base_url}}/auth/resend-verification-email
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "vishal@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "If this email exists and is unverified, a new OTP has been sent."
}
```

---

### POST — Login

```
POST {{base_url}}/auth/login
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "vishal@example.com",
  "password": "SecurePass@123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "v3.local.abcdef1234567890...",
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Vishal Sanam",
      "email": "vishal@example.com",
      "role": "admin"
    }
  }
}
```

> 🍪 The server also sets a `refreshToken` HttpOnly cookie automatically.
> Copy `data.accessToken` → Postman env var `access_token`.
> Copy `data.user.id` → Postman env var `user_id`.

---

### POST — Refresh Access Token

```
POST {{base_url}}/auth/refresh-token
```

**Headers:** _(none needed — reads `refreshToken` cookie automatically)_

**Body:** _(empty — no body required)_

> In Postman: Go to **Settings → Cookies** → ensure cookie `refreshToken` from `localhost` is passed.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "v3.local.abcdef1234567890..."
  }
}
```

---

### POST — Forgot Password

```
POST {{base_url}}/auth/forgot-password
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "vishal@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "If this email is registered, a password reset link has been sent."
}
```

> The reset token is emailed. Copy the token from the email link into the `reset_token` env var.

---

### POST — Reset Password

```
POST {{base_url}}/auth/reset-password
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "token": "{{reset_token}}",
  "password": "NewSecurePass@456"
}
```

Token is a 64-character hex string. Expires in 1 hour.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully. You can now log in with your new password."
}
```

---

### POST — Logout _(🔒 Protected)_

```
POST {{base_url}}/auth/logout
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

> Blacklists both access and refresh tokens in Redis. Cookie is cleared.

---

### POST — Change Password _(🔒 Protected)_

```
POST {{base_url}}/auth/change-password
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "currentPassword": "SecurePass@123",
  "newPassword": "NewSecurePass@456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

---

### GET — List Sessions _(🔒 Protected)_

```
GET {{base_url}}/auth/sessions
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

Lists all active refresh token sessions for your account.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      { "jti": "a1b2c3d4-e5f6-...", "createdAt": "2026-03-01T10:00:00Z" }
    ]
  }
}
```

> Copy a `jti` value into `session_jti` env var to use below.

---

### DELETE — Revoke Session by JTI _(🔒 Protected)_

```
DELETE {{base_url}}/auth/sessions/{{session_jti}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session revoked."
}
```

---

### DELETE — Revoke All Sessions _(🔒 Protected)_

```
DELETE {{base_url}}/auth/sessions
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

Logs you out from all devices.

**Success Response (200):**
```json
{
  "success": true,
  "message": "All sessions revoked."
}
```

---

## 👤 3. Users — `/api/v1/users`

> All routes require `Authorization: Bearer {{access_token}}`
> Password changes: use `POST /api/v1/auth/change-password` instead.

---

### GET — Get My Profile _(🔒 Protected)_

```
GET {{base_url}}/users/me
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Vishal Sanam",
      "email": "vishal@example.com",
      "role": "admin",
      "isVerified": true
    }
  }
}
```

---

### PATCH — Update My Profile _(🔒 Protected)_

```
PATCH {{base_url}}/users/me
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "Vishal S."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Vishal S.",
      "email": "vishal@example.com"
    }
  }
}
```

---

### GET — Get User by ID _(🔒 Protected — Admin Only)_

```
GET {{base_url}}/users/{{user_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

---

## 🏢 4. Organizations — `/api/v1/orgs`

> All routes require `Authorization: Bearer {{access_token}}`

---

### POST — Create Organization _(🔒 Protected)_

```
POST {{base_url}}/orgs
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "LexAI Legal Ltd"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "org": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "name": "LexAI Legal Ltd",
      "slug": "lexai-legal-ltd",
      "plan": "free",
      "memberCount": 1
    }
  }
}
```

> Copy `data.org.id` → `org_id` env var.

---

### GET — Get Organization _(🔒 Protected)_

```
GET {{base_url}}/orgs/{{org_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "org": { ... } }
}
```

---

### PATCH — Update Organization _(🔒 Protected — Admin/Manager)_

```
PATCH {{base_url}}/orgs/{{org_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "LexAI Legal Group"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "org": { ... } }
}
```

---

### POST — Invite Member _(🔒 Protected — Admin/Manager)_

```
POST {{base_url}}/orgs/{{org_id}}/invite
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "newmember@example.com",
  "role": "viewer"
}
```

Roles: `"admin"`, `"manager"`, `"viewer"` (default: `"viewer"`).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Invitation sent to newmember@example.com",
  "data": {
    "invitationId": "65f1a2b3c4d5e6f7a8b9c0d3",
    "expiresAt": "2026-03-10T17:00:00.000Z"
  }
}
```

---

### POST — Accept Invitation _(Public — No token required)_

```
POST {{base_url}}/orgs/{{org_id}}/invite/accept
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "token": "{{invite_token}}",
  "name": "New Member",
  "password": "Welcome@123"
}
```

`name` and `password` are required if the user is new (no existing account).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Invitation accepted. Your account has been created.",
  "data": { ... }
}
```

---

### PATCH — Change Member Role _(🔒 Protected — Admin only)_

```
PATCH {{base_url}}/orgs/{{org_id}}/members/{{user_id}}/role
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "role": "manager"
}
```

Roles: `"admin"`, `"manager"`, `"viewer"`.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member role updated successfully."
}
```

---

### DELETE — Remove Member _(🔒 Protected — Admin only)_

```
DELETE {{base_url}}/orgs/{{org_id}}/members/{{user_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member removed from organization."
}
```

---

## 📄 5. Contracts — `/api/v1/contracts`

> All routes require `Authorization: Bearer {{access_token}}` + org membership.
> The server resolves `orgId` automatically from your PASETO token.

---

### POST — Upload Contract (File) _(🔒 Protected)_

```
POST {{base_url}}/contracts
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body (form-data):**
| Key       | Type | Value                        |
|-----------|------|------------------------------|
| `file`    | File | Select a `.pdf`, `.docx`, or `.txt` file (max 5MB) |
| `title`   | Text | `Service Agreement 2026`     |
| `type`    | Text | `NDA`                        |
| `tags`    | Text | `["legal","2026"]`           |

Types: `NDA`, `Vendor`, `Employment`, `SaaS`, `Other`.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Contract uploaded successfully",
  "data": {
    "contract": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d4",
      "title": "Service Agreement 2026",
      "type": "NDA",
      "version": 1,
      "contentHash": "abc123def456..."
    }
  }
}
```

> Copy `data.contract.id` → `contract_id` env var.

---

### POST — Upload Contract (Raw Text) _(🔒 Protected)_

```
POST {{base_url}}/contracts
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "title": "Simple NDA Agreement",
  "type": "NDA",
  "content": "This Non-Disclosure Agreement is entered into as of March 1, 2026, between Party A and Party B. Both parties agree to keep all shared information confidential...",
  "tags": ["nda", "confidential"],
  "expiryDate": "2027-03-01",
  "jurisdiction": "India"
}
```

`content` must be at least 50 characters.

---

### GET — List Contracts _(🔒 Protected)_

```
GET {{base_url}}/contracts
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (all optional):**
| Param    | Type   | Default      | Options                                        |
|----------|--------|--------------|------------------------------------------------|
| `page`   | number | 1            |                                                |
| `limit`  | number | 10           | 1–100                                          |
| `sortBy` | string | `createdAt`  | `createdAt`, `title`, `type`, `riskScore`, `expiryDate` |
| `order`  | string | `desc`       | `asc`, `desc`                                  |
| `type`   | string | _(none)_     | `NDA`, `Vendor`, `Employment`, `SaaS`, `Other` |
| `tag`    | string | _(none)_     | any tag string                                 |
| `search` | string | _(none)_     | full-text search in title                      |

**Example:**
```
GET {{base_url}}/contracts?page=1&limit=10&type=NDA&order=desc
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "contracts": [ ... ],
    "meta": { "total": 25, "page": 1, "limit": 10, "totalPages": 3 }
  }
}
```

---

### GET — Get Contract by ID _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "contract": { ... } }
}
```

---

### PATCH — Update Contract _(🔒 Protected)_

```
PATCH {{base_url}}/contracts/{{contract_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON — all fields optional):**
```json
{
  "title": "Updated NDA Agreement",
  "type": "NDA",
  "tags": ["updated", "nda"],
  "alertDays": [30, 7],
  "expiryDate": "2027-06-01"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "contract": { ... } }
}
```

---

### DELETE — Delete Contract _(🔒 Protected — Admin/Manager only)_

```
DELETE {{base_url}}/contracts/{{contract_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "message": "Contract deleted successfully."
}
```

---

### POST — Upload New Version _(🔒 Protected)_

```
POST {{base_url}}/contracts/{{contract_id}}/versions
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "content": "Revised NDA Agreement text. This agreement is entered into as of March 1, 2026, between Party A and Party B...",
  "changeNote": "Updated confidentiality clause in section 3."
}
```

`content` must be at least 50 characters.

**Success Response (201):**
```json
{
  "success": true,
  "data": { "version": 2, ... }
}
```

---

### GET — List Versions _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}/versions
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "versions": [ { "version": 1, ... }, { "version": 2, ... } ] }
}
```

---

### POST — Compare Versions _(🔒 Protected — Pro/Enterprise)_

```
POST {{base_url}}/contracts/{{contract_id}}/compare
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "versionA": 1,
  "versionB": 2
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": { "diff": "...", "summary": "..." }
}
```

---

### GET — Audit Trail _(🔒 Protected)_

```
GET {{base_url}}/contracts/{{contract_id}}/audit
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "action": "contract.created",
        "userId": "...",
        "timestamp": "2026-03-01T10:00:00Z"
      }
    ]
  }
}
```

---

## 🤖 6. Analyses — `/api/v1/analyses`

> All routes require `Authorization: Bearer {{access_token}}` + org membership.

---

### POST — Request AI Analysis _(🔒 Protected)_

```
POST {{base_url}}/analyses
```

**Headers:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "contractId": "{{contract_id}}",
  "version": 1
}
```

`version` is optional. If omitted, the latest version is analysed.

**Success Response — Cached (200):**
```json
{
  "success": true,
  "message": "Analysis result retrieved from cache.",
  "data": { "cached": true, "analysis": { ... } }
}
```

**Success Response — Queued (202):**
```json
{
  "success": true,
  "message": "Analysis job queued. You will receive a WebSocket notification when complete.",
  "data": {
    "analysisId": "65f1a2b3c4d5e6f7a8b9c0d5",
    "status": "pending",
    "estimatedSeconds": 30
  }
}
```

> Copy `data.analysisId` → `analysis_id` env var.

---

### GET — Get Analysis by ID _(🔒 Protected)_

```
GET {{base_url}}/analyses/{{analysis_id}}
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
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
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "analyses": [ { ... }, { ... } ]
  }
}
```

---

## 🔔 7. Notifications — `/api/v1/notifications`

> All routes require `Authorization: Bearer {{access_token}}`

---

### GET — List Notifications _(🔒 Protected)_

```
GET {{base_url}}/notifications
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (optional):**
| Param   | Type    | Default | Description                     |
|---------|---------|---------|---------------------------------|
| `page`  | number  | 1       |                                 |
| `limit` | number  | 20      |                                 |
| `read`  | boolean | _(all)_ | `true` or `false` to filter     |

**Example:**
```
GET {{base_url}}/notifications?read=false&page=1&limit=20
```

**Success Response (200):**
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
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "unreadCount": 3
}
```

---

### PATCH — Mark All as Read _(🔒 Protected)_

```
PATCH {{base_url}}/notifications/read-all
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "modifiedCount": 3
}
```

---

### PATCH — Mark One as Read _(🔒 Protected)_

```
PATCH {{base_url}}/notifications/{{notification_id}}/read
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "notification": { "_id": "...", "read": true, "readAt": "2026-03-03T17:00:00Z" }
}
```

---

## 🌍 8. Enrichment — `/api/v1/enrichment`

> All routes require `Authorization: Bearer {{access_token}}`
> These call external public APIs. Non-critical — degrade gracefully.

---

### GET — Country Info _(🔒 Protected)_

```
GET {{base_url}}/enrichment/country/India
```

Replace `India` with any country name (min 2 characters).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "country": {
    "name": "India",
    "capital": "New Delhi",
    "currency": { "INR": { "name": "Indian rupee", "symbol": "₹" } },
    "region": "Asia",
    "flag": "🇮🇳"
  }
}
```

---

### GET — World Time _(🔒 Protected)_

```
GET {{base_url}}/enrichment/time/Asia/Kolkata
```

Replace `Asia/Kolkata` with any valid IANA timezone (e.g. `America/New_York`, `Europe/London`).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "time": {
    "timezone": "Asia/Kolkata",
    "datetime": "2026-03-03T22:50:00.000+05:30",
    "utc_offset": "+05:30"
  }
}
```

---

### GET — Check Holiday _(🔒 Protected)_

```
GET {{base_url}}/enrichment/holidays?country=IN&date=2026-03-15
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (required):**
| Param     | Description                         | Example        |
|-----------|-------------------------------------|----------------|
| `country` | ISO 2-letter country code           | `IN`, `US`, `GB` |
| `date`    | Date to check in `YYYY-MM-DD` format | `2026-03-15`   |

**Success Response (200):**
```json
{
  "success": true,
  "holiday": {
    "isHoliday": false,
    "holidays": []
  }
}
```

---

### GET — Public Holidays for Year _(🔒 Protected)_

```
GET {{base_url}}/enrichment/holidays/US/2026
```

Replace `US` with any 2-letter ISO country code. Replace `2026` with any year (2000–2100).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "holidays": [
      {
        "date": "2026-01-01",
        "localName": "New Year's Day",
        "name": "New Year's Day",
        "countryCode": "US"
      }
    ],
    "country": "US",
    "year": 2026
  }
}
```

**Error Response (400 — invalid country code):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Country must be a 2-letter ISO code (e.g., US, GB)." }
}
```

**Error Response (400 — invalid year):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Year must be a valid number between 2000 and 2100." }
}
```

---

### GET — IP Geolocation _(🔒 Protected)_

```
GET {{base_url}}/enrichment/ip/8.8.8.8
```

Replace `8.8.8.8` with any valid IPv4 or IPv6 address. Useful for flagging logins from unexpected locations.

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "ipInfo": {
      "ip": "8.8.8.8",
      "city": "Mountain View",
      "region": "California",
      "country": "US",
      "org": "AS15169 Google LLC",
      "timezone": "America/Los_Angeles"
    }
  }
}
```

**Error Response (400 — invalid IP):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid IP address format." }
}
```

---

### GET — Validate Email _(🔒 Protected)_

```
GET {{base_url}}/enrichment/email/validate?email=user@example.com
```

Validates email syntax, MX records, and checks if it is a disposable address (EVA + Disify).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (required):**
| Param   | Description              | Example              |
|---------|--------------------------|----------------------|
| `email` | Email address to validate | `user@example.com`   |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "validation": {
      "valid": true,
      "mx_records": true
    },
    "disposable": {
      "disposable": false,
      "domain": "example.com"
    }
  }
}
```

**Error Response (400 — missing/invalid email):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "A valid email address is required." }
}
```

---

### GET — Email Reputation _(🔒 Protected)_

```
GET {{base_url}}/enrichment/email/reputation?email=user@example.com
```

Returns threat/risk reputation scoring for an email address (EmailRep).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (required):**
| Param   | Description              | Example              |
|---------|--------------------------|----------------------|
| `email` | Email address to check    | `user@example.com`   |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "reputation": {
      "reputation": "high",
      "suspicious": false,
      "references": 15,
      "details": {
        "blacklisted": false,
        "malicious_activity": false,
        "credentials_leaked": false,
        "data_breach": false
      }
    }
  }
}
```

**Fallback Response (200 — service unavailable):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "reputation": { "note": "Reputation service unavailable" }
  }
}
```

---

### GET — Email Breach Check _(🔒 Protected)_

```
GET {{base_url}}/enrichment/email/breaches?email=user@example.com
```

Checks if an email has appeared in known data breaches via HaveIBeenPwned (HIBP). Requires `HIBP_API_KEY` to be configured in `.env`.

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (required):**
| Param   | Description              | Example              |
|---------|--------------------------|----------------------|
| `email` | Email address to check    | `user@example.com`   |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "breaches": [
      {
        "Name": "ExampleBreach",
        "BreachDate": "2023-01-15",
        "Description": "..."
      }
    ]
  }
}
```

**Fallback Response (200 — no API key configured):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "breaches": { "note": "Breach check unavailable — HIBP_API_KEY may not be configured." }
  }
}
```

---

### GET — Currency Exchange Rate _(🔒 Protected)_

```
GET {{base_url}}/enrichment/currency/rate?from=USD&to=EUR
```

Returns the latest exchange rate between two currencies (Frankfurter / ECB data).

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters (required):**
| Param  | Description                  | Example |
|--------|------------------------------|---------|
| `from` | Source currency (3-letter ISO) | `USD`   |
| `to`   | Target currency (3-letter ISO) | `EUR`   |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "exchange": {
      "base": "USD",
      "target": "EUR",
      "rate": 0.9234,
      "date": "2026-03-31"
    }
  }
}
```

**Error Response (400 — missing params):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Both \"from\" and \"to\" currency codes are required (e.g., USD, EUR)." }
}
```

**Error Response (400 — invalid code):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Currency codes must be 3-letter ISO codes (e.g., USD, EUR, GBP)." }
}
```

---

### GET — Multiple Currency Exchange Rates _(🔒 Protected)_

```
GET {{base_url}}/enrichment/currency/rates?base=USD&targets=EUR,GBP,JPY
```

Returns exchange rates from a base currency to multiple target currencies.

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
| Param     | Required | Description                                      | Example         |
|-----------|----------|--------------------------------------------------|-----------------|
| `base`    | Yes      | Base currency (3-letter ISO)                      | `USD`           |
| `targets` | No       | Comma-separated target currencies. If omitted, returns all available rates. | `EUR,GBP,JPY`  |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "exchange": {
      "base": "USD",
      "date": "2026-03-31",
      "rates": {
        "EUR": 0.9234,
        "GBP": 0.7891,
        "JPY": 149.52
      }
    }
  }
}
```

**Error Response (400 — missing base):**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Base currency code is required (e.g., USD)." }
}
```

---

## 🛡️ 9. Admin — `/api/v1/admin` ✅

> All routes require `Authorization: Bearer {{admin_token}}` + **`role: admin`**.

### 🔑 Getting Admin Access

**Step 1 — Seed the admin user (run once on a fresh database):**
```bash
npm run seed
```
Default credentials (from `.env`):
- Email: `admin@lexai.io`
- Password: `Admin112233`

**Step 2 — Login with admin credentials:**
```
POST {{base_url}}/auth/login
Content-Type: application/json

{
  "email": "admin@lexai.io",
  "password": "Admin112233"
}
```
Copy `data.accessToken` → set as `admin_token` in your Postman environment.

> ⚠️ Use `{{admin_token}}` (not `{{access_token}}`) for all admin endpoints so you don't overwrite your regular user token.

---

### GET — Platform Stats _(🔒 Admin only)_

```
GET {{base_url}}/admin/stats
```

**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 42,
      "totalOrgs": 8,
      "totalContracts": 156,
      "totalAnalyses": 89,
      "analysesLast30Days": 23,
      "averageRiskScore": 6.4,
      "queueDepth": 0
    }
  }
}
```

---

### GET — Queue Status _(🔒 Admin only)_

```
GET {{base_url}}/admin/queue/status
```

**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "queue": {
      "name": "lexai.analysis.queue",
      "messageCount": 0,
      "consumerCount": 1,
      "dlxMessageCount": 0
    }
  }
}
```

---

### GET — List All Users _(🔒 Admin only)_

```
GET {{base_url}}/admin/users
```

**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Query Parameters (optional):**
| Param   | Default |
|---------|---------|
| `page`  | 1       |
| `limit` | 20      |

**Example:**
```
GET {{base_url}}/admin/users?page=1&limit=20
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [ { ... }, { ... } ],
    "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
  }
}
```

---

### POST — Create User _(🔒 Admin only)_

```
POST {{base_url}}/admin/users
```

Admin-created users are pre-verified and skip the OTP email flow entirely.

**Headers:**
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass@123",
  "role": "viewer"
}
```

Roles: `"admin"`, `"manager"`, `"viewer"` — **required, no default**.

**Password rules:** min 8 chars, must contain uppercase, lowercase, digit, special char.

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully.",
  "data": {
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "viewer",
      "emailVerified": true,
      "isActive": true
    }
  }
}
```

---

### PATCH — Update User _(🔒 Admin only)_

```
PATCH {{base_url}}/admin/users/{{user_id}}
```

Update a user's name, role, or active status. Send only the fields you want to change.

**Headers:**
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

**Body (raw JSON — all fields optional, send only what you want to change):**
```json
{
  "name": "John Updated",
  "role": "manager",
  "isActive": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully.",
  "data": { "user": { ... } }
}
```

---

### DELETE — Deactivate User _(🔒 Admin only)_

```
DELETE {{base_url}}/admin/users/{{user_id}}
```

Soft-deactivates the user (sets `isActive: false`). The account is not deleted — the user just can't log in.

**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Body:** _(empty)_

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deactivated successfully."
}
```

> To reactivate, use `PATCH /admin/users/{{user_id}}` with `{ "isActive": true }`.

---

### GET — Audit Logs _(🔒 Admin only)_

```
GET {{base_url}}/admin/audit-logs
```

**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Query Parameters (optional):**
| Param      | Description                      |
|------------|----------------------------------|
| `page`     | Page number (default: 1)         |
| `limit`    | Results per page (default: 20)   |
| `orgId`    | Filter by organisation           |
| `userId`   | Filter by user                   |
| `action`   | Filter by action (e.g. `user.login`) |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [ { "action": "user.login", "userId": "...", "timestamp": "..." } ],
    "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
  }
}
```

---

## ⚠️ Common Error Responses

All errors follow this shape:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access token is missing or invalid."
  }
}
```

| HTTP Code | Error Code          | Meaning                                    |
|-----------|---------------------|-------------------------------------------|
| `400`     | `VALIDATION_ERROR`  | Request body failed Joi validation         |
| `400`     | `FILE_TOO_LARGE`    | Uploaded file exceeds 5MB                  |
| `400`     | `UPLOAD_ERROR`      | Unsupported file type or multer error      |
| `401`     | `UNAUTHORIZED`      | Missing or expired access token            |
| `401`     | `TOKEN_EXPIRED`     | Access token has expired                   |
| `403`     | `FORBIDDEN`         | Role not authorized for this action        |
| `404`     | `NOT_FOUND`         | Resource not found                         |
| `409`     | `CONFLICT`          | Duplicate resource (e.g. email taken)      |
| `429`     | `TOO_MANY_REQUESTS` | Rate limit exceeded                        |
| `500`     | `INTERNAL_ERROR`    | Unexpected server error                    |
| `503`     | _(health check)_    | One or more services are down              |

---

## 🔄 Recommended Testing Order

```
1.  GET    /health                              ← Verify all services are up

# ── Admin setup (run npm run seed first) ──────────────────────────────────
2.  POST   /auth/login (admin creds)            ← email: admin@lexai.io / Admin112233 → copy admin_token
3.  POST   /admin/users                         ← Create a user directly; copy user_id
4.  PATCH  /admin/users/{{user_id}}             ← Update role or status
5.  GET    /admin/users                         ← List all users
6.  GET    /admin/stats                         ← Platform stats
7.  GET    /admin/queue/status                  ← RabbitMQ queue health
8.  GET    /admin/audit-logs                    ← Global audit trail

# ── Regular user flow ──────────────────────────────────────────────────────
9.  POST   /auth/register                       ← Create account; copy otp from dev response
10. POST   /auth/verify-email                   ← Verify OTP
11. POST   /auth/login                          ← Copy access_token + user_id
12. GET    /users/me                            ← Get your profile
13. PATCH  /users/me                            ← Update your name
14. GET    /auth/sessions                       ← Copy a jti → session_jti
15. POST   /orgs                                ← Create org; copy org_id
16. GET    /orgs/{{org_id}}                     ← View org
17. POST   /contracts (file or JSON)            ← Upload; copy contract_id
18. GET    /contracts                           ← List contracts
19. GET    /contracts/{{contract_id}}           ← View single contract
20. PATCH  /contracts/{{contract_id}}           ← Update contract
21. POST   /contracts/{{contract_id}}/versions  ← Upload new version
22. GET    /contracts/{{contract_id}}/versions  ← List versions
23. POST   /contracts/{{contract_id}}/compare   ← Compare two versions
24. GET    /contracts/{{contract_id}}/audit     ← View audit trail
25. POST   /analyses                            ← Queue analysis; copy analysis_id
26. GET    /analyses/{{analysis_id}}            ← Poll for result
27. GET    /analyses/contract/{{contract_id}}   ← All analyses for contract
28. GET    /notifications/unread-count          ← Check badge count
29. GET    /notifications                       ← View notifications; copy notification_id
30. PATCH  /notifications/{{notification_id}}/read  ← Mark one as read
31. PATCH  /notifications/read-all              ← Mark all as read

# ── Enrichment APIs ───────────────────────────────────────────────────────
32. GET    /enrichment/country/India            ← Country info
33. GET    /enrichment/time/Asia/Kolkata        ← World time
34. GET    /enrichment/holidays?country=IN&date=2026-03-15  ← Check specific holiday
35. GET    /enrichment/holidays/US/2026         ← All holidays for a year
36. GET    /enrichment/ip/8.8.8.8              ← IP geolocation
37. GET    /enrichment/email/validate?email=user@example.com  ← Email validation
38. GET    /enrichment/email/reputation?email=user@example.com ← Email reputation
39. GET    /enrichment/email/breaches?email=user@example.com   ← Email breach check
40. GET    /enrichment/currency/rate?from=USD&to=EUR           ← Single exchange rate
41. GET    /enrichment/currency/rates?base=USD&targets=EUR,GBP ← Multiple rates

# ── Cleanup ────────────────────────────────────────────────────────────────
42. DELETE /contracts/{{contract_id}}           ← Delete contract (admin/manager)
43. DELETE /auth/sessions/{{session_jti}}       ← Revoke specific session
44. DELETE /auth/sessions                       ← Revoke all sessions
45. DELETE /admin/users/{{user_id}}             ← (Admin) Deactivate user
46. POST   /auth/logout                         ← Blacklist tokens
```

---

## 📊 Complete API Endpoint Summary

| #  | Method   | URL                                              | Auth      | Description                        |
|----|----------|--------------------------------------------------|-----------|------------------------------------|
| 1  | `GET`    | `/health`                                        | None      | Health check                       |
| 2  | `POST`   | `/api/v1/auth/register`                          | None      | Register new user                  |
| 3  | `POST`   | `/api/v1/auth/verify-email`                      | None      | Verify email OTP                   |
| 4  | `POST`   | `/api/v1/auth/resend-verification-email`         | None      | Resend OTP                         |
| 5  | `POST`   | `/api/v1/auth/login`                             | None      | Login                              |
| 6  | `POST`   | `/api/v1/auth/refresh-token`                     | Cookie    | Refresh access token               |
| 7  | `POST`   | `/api/v1/auth/forgot-password`                   | None      | Send reset email                   |
| 8  | `POST`   | `/api/v1/auth/reset-password`                    | None      | Reset password with token          |
| 9  | `POST`   | `/api/v1/auth/logout`                            | Bearer    | Logout + blacklist tokens          |
| 10 | `POST`   | `/api/v1/auth/change-password`                   | Bearer    | Change password                    |
| 11 | `GET`    | `/api/v1/auth/sessions`                          | Bearer    | List active sessions               |
| 12 | `DELETE` | `/api/v1/auth/sessions/:jti`                     | Bearer    | Revoke specific session            |
| 13 | `DELETE` | `/api/v1/auth/sessions`                          | Bearer    | Revoke all sessions                |
| 14 | `GET`    | `/api/v1/users/me`                               | Bearer    | Get my profile                     |
| 15 | `PATCH`  | `/api/v1/users/me`                               | Bearer    | Update my profile                  |
| 16 | `GET`    | `/api/v1/users/:id`                              | Admin     | Get user by ID                     |
| 17 | `POST`   | `/api/v1/orgs`                                   | Bearer    | Create organization                |
| 18 | `GET`    | `/api/v1/orgs/:orgId`                            | Bearer    | Get organization                   |
| 19 | `PATCH`  | `/api/v1/orgs/:orgId`                            | Admin/Mgr | Update organization                |
| 20 | `POST`   | `/api/v1/orgs/:orgId/invite`                     | Admin/Mgr | Invite member                      |
| 21 | `POST`   | `/api/v1/orgs/:orgId/invite/accept`              | None      | Accept invitation                  |
| 22 | `PATCH`  | `/api/v1/orgs/:orgId/members/:userId/role`       | Admin     | Change member role                 |
| 23 | `DELETE` | `/api/v1/orgs/:orgId/members/:userId`            | Admin     | Remove member                      |
| 24 | `POST`   | `/api/v1/contracts`                              | Bearer+Org| Upload contract (file or JSON)     |
| 25 | `GET`    | `/api/v1/contracts`                              | Bearer+Org| List contracts                     |
| 26 | `GET`    | `/api/v1/contracts/:id`                          | Bearer+Org| Get contract by ID                 |
| 27 | `PATCH`  | `/api/v1/contracts/:id`                          | Bearer+Org| Update contract                    |
| 28 | `DELETE` | `/api/v1/contracts/:id`                          | Admin/Mgr | Delete contract                    |
| 29 | `POST`   | `/api/v1/contracts/:id/versions`                 | Bearer+Org| Upload new version                 |
| 30 | `GET`    | `/api/v1/contracts/:id/versions`                 | Bearer+Org| List versions                      |
| 31 | `POST`   | `/api/v1/contracts/:id/compare`                  | Bearer+Org| Compare versions                   |
| 32 | `GET`    | `/api/v1/contracts/:id/audit`                    | Bearer+Org| Audit trail                        |
| 33 | `POST`   | `/api/v1/analyses`                               | Bearer+Org| Request AI analysis                |
| 34 | `GET`    | `/api/v1/analyses/:id`                           | Bearer+Org| Get analysis by ID                 |
| 35 | `GET`    | `/api/v1/analyses/contract/:contractId`          | Bearer+Org| All analyses for contract          |
| 36 | `GET`    | `/api/v1/notifications`                          | Bearer    | List notifications                 |
| 37 | `GET`    | `/api/v1/notifications/unread-count`             | Bearer    | Get unread count                   |
| 38 | `PATCH`  | `/api/v1/notifications/read-all`                 | Bearer    | Mark all as read                   |
| 39 | `PATCH`  | `/api/v1/notifications/:id/read`                 | Bearer    | Mark one as read                   |
| 40 | `GET`    | `/api/v1/enrichment/country/:name`               | Bearer    | Country info                       |
| 41 | `GET`    | `/api/v1/enrichment/time/:timezone`              | Bearer    | World time                         |
| 42 | `GET`    | `/api/v1/enrichment/holidays`                    | Bearer    | Check holiday by date              |
| 43 | `GET`    | `/api/v1/enrichment/holidays/:country/:year`     | Bearer    | All holidays for a year            |
| 44 | `GET`    | `/api/v1/enrichment/ip/:ip`                      | Bearer    | IP geolocation                     |
| 45 | `GET`    | `/api/v1/enrichment/email/validate`              | Bearer    | Email validation                   |
| 46 | `GET`    | `/api/v1/enrichment/email/reputation`            | Bearer    | Email reputation                   |
| 47 | `GET`    | `/api/v1/enrichment/email/breaches`              | Bearer    | Email breach check (HIBP)          |
| 48 | `GET`    | `/api/v1/enrichment/currency/rate`               | Bearer    | Single exchange rate               |
| 49 | `GET`    | `/api/v1/enrichment/currency/rates`              | Bearer    | Multiple exchange rates            |
| 50 | `GET`    | `/api/v1/admin/stats`                            | Admin     | Platform stats                     |
| 51 | `GET`    | `/api/v1/admin/queue/status`                     | Admin     | Queue status                       |
| 52 | `GET`    | `/api/v1/admin/users`                            | Admin     | List all users                     |
| 53 | `POST`   | `/api/v1/admin/users`                            | Admin     | Create user (pre-verified)         |
| 54 | `PATCH`  | `/api/v1/admin/users/:id`                        | Admin     | Update user                        |
| 55 | `DELETE` | `/api/v1/admin/users/:id`                        | Admin     | Deactivate user                    |
| 56 | `GET`    | `/api/v1/admin/audit-logs`                       | Admin     | Global audit trail                 |
