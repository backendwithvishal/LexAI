# LexAI — Complete Postman Collection

> **Base URL:** `http://localhost:3500/api/v1`
> **Local Port:** `3500` (set in `.env`)
> **API Version:** `v1` (set in `.env`)

---

## Postman Environment Variables

Create a Postman **Environment** with these variables:

| Variable | Initial Value | Description |
|---|---|---|
| `base_url` | `http://localhost:3500/api/v1` | Base API URL |
| `access_token` | *(set after login)* | PASETO access token — regular user |
| `admin_token` | *(set after admin login)* | PASETO access token — admin role |
| `manager_token` | *(set after manager login)* | PASETO access token — manager role |
| `refresh_token` | *(auto-set via cookie)* | HttpOnly cookie set by server |
| `org_id` | *(set after createOrg)* | MongoDB ObjectId of your org |
| `contract_id` | *(set after create contract)* | MongoDB ObjectId of a contract |
| `analysis_id` | *(set after requestAnalysis)* | MongoDB ObjectId of an analysis |
| `user_id` | *(set after login)* | MongoDB ObjectId of your user |
| `target_user_id` | *(another user id)* | Used for admin user operations |
| `notification_id` | *(from GET /notifications)* | MongoDB ObjectId of a notification |
| `otp` | *(from email / dev response)* | 6-digit OTP for email verification |
| `reset_token` | *(from forgot-password email)* | Hex token for password reset |
| `session_jti` | *(from GET /auth/sessions)* | UUID JTI of a session to revoke |
| `invite_token` | *(from invitation email)* | Invitation acceptance token |
| `comment_id` | *(from POST /comments)* | MongoDB ObjectId of a comment |
| `template_id` | *(from POST /templates)* | MongoDB ObjectId of a template |
| `share_link_id` | *(from POST /shares)* | MongoDB ObjectId of a share link |
| `bookmark_contract_id` | *(from POST /bookmarks)* | Contract ID of a bookmarked item |
| `tag_name` | `legal` | Tag string for tag operations |

> **Protected routes** require: `Authorization: Bearer {{access_token}}`
> **Admin-only routes** use: `Authorization: Bearer {{admin_token}}`
> **Admin/Manager routes** use either `{{admin_token}}` or `{{manager_token}}`

---

## Role Reference

| Role | Can Do |
|---|---|
| `admin` | Everything — all CRUD, bulk ops, admin panel, delete any resource |
| `manager` | Create/update/delete contracts, invite members, bulk ops, share links, tags, templates |
| `viewer` | Read-only — list/get contracts, analyses, comments, bookmarks, dashboard |

---

## 1. Health Check

No authentication required.

### GET — Health Check

```
GET http://localhost:3500/health
```

**Success (200):**
```json
{
  "status": "ok",
  "services": { "mongodb": "up", "redis": "up", "rabbitmq": "up" },
  "timestamp": "2026-05-07T10:00:00.000Z",
  "uptime": 3600
}
```

---

## 2. Auth — `/api/v1/auth`

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
Password rules: min 8 chars, uppercase + lowercase + digit + special char.

**Success (201):**
```json
{
  "success": true,
  "message": "Registration successful. A 6-digit OTP has been sent to your email.",
  "data": { "userId": "65f1a2b3c4d5e6f7a8b9c0d1", "email": "vishal@example.com", "otp": "482910" }
}
```
> `otp` only appears in **development** mode.

---

### POST — Verify Email

```
POST {{base_url}}/auth/verify-email
Content-Type: application/json
```
```json
{ "email": "vishal@example.com", "otp": "{{otp}}" }
```

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

---

### POST — Login (Regular User)

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
  "data": {
    "accessToken": "v3.local.abcdef...",
    "user": { "id": "65f1a2b3c4d5e6f7a8b9c0d1", "name": "Vishal Sanam", "email": "vishal@example.com", "role": "viewer" }
  }
}
```
> Copy `data.accessToken` to `access_token`. Copy `data.user.id` to `user_id`.

---

### POST — Login (Admin)

```
POST {{base_url}}/auth/login
Content-Type: application/json
```
```json
{ "email": "admin@example.com", "password": "AdminPass@123" }
```
> Copy `data.accessToken` to `admin_token`.

---

### POST — Login (Manager)

```
POST {{base_url}}/auth/login
Content-Type: application/json
```
```json
{ "email": "manager@example.com", "password": "ManagerPass@123" }
```
> Copy `data.accessToken` to `manager_token`.

---

### POST — Refresh Access Token

```
POST {{base_url}}/auth/refresh-token
```
No body — reads `refreshToken` cookie automatically.

---

### POST — Forgot Password

```
POST {{base_url}}/auth/forgot-password
Content-Type: application/json
```
```json
{ "email": "vishal@example.com" }
```

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

---

### POST — Logout (Protected)

```
POST {{base_url}}/auth/logout
Authorization: Bearer {{access_token}}
```

---

### POST — Change Password (Protected)

```
POST {{base_url}}/auth/change-password
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "currentPassword": "SecurePass@123", "newPassword": "NewSecurePass@456" }
```

---

### GET — List Sessions (Protected)

```
GET {{base_url}}/auth/sessions
Authorization: Bearer {{access_token}}
```
> Copy a `jti` value to `session_jti`.

---

### DELETE — Revoke Session by JTI (Protected)

```
DELETE {{base_url}}/auth/sessions/{{session_jti}}
Authorization: Bearer {{access_token}}
```

---

### DELETE — Revoke All Sessions (Protected)

```
DELETE {{base_url}}/auth/sessions
Authorization: Bearer {{access_token}}
```

---

## 3. Users — `/api/v1/users`

> All routes require `Authorization: Bearer {{access_token}}`

### GET — Get My Profile

```
GET {{base_url}}/users/me
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "65f1a2b3c4d5e6f7a8b9c0d1", "name": "Vishal Sanam", "email": "vishal@example.com", "role": "viewer", "isVerified": true }
  }
}
```

---

### PATCH — Update My Profile

```
PATCH {{base_url}}/users/me
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "name": "Vishal S." }
```
Only `name` can be updated here.

---

### GET — Get User by ID (Admin only)

```
GET {{base_url}}/users/{{user_id}}
Authorization: Bearer {{admin_token}}
```

---

### PATCH — Change User Role (Admin only)

```
PATCH {{base_url}}/users/{{target_user_id}}/role
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "role": "manager" }
```
- `role` — required, one of: `admin`, `manager`, `viewer`
- Cannot change your own role (`SELF_ROLE_CHANGE` error)
- Syncs role across User document, org members array, and Redis cache immediately

**Success (200):**
```json
{
  "success": true,
  "message": "User role updated to 'manager' successfully.",
  "data": { "userId": "65f1a2b3c4d5e6f7a8b9c0d1", "role": "manager" }
}
```

**Error — Self role change (400):**
```json
{
  "success": false,
  "code": "SELF_ROLE_CHANGE",
  "message": "You cannot change your own role."
}
```

**Error — Non-admin attempt (403):**
```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Access denied. Required roles: admin. Your role: viewer."
}
```

---

## 4. Organizations — `/api/v1/orgs`

### POST — Create Organization (Protected)

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
> Copy `data.org.id` to `org_id`.

---

### GET — Get Organization (Protected)

```
GET {{base_url}}/orgs/{{org_id}}
Authorization: Bearer {{access_token}}
```

---

### PATCH — Update Organization (Admin/Manager)

```
PATCH {{base_url}}/orgs/{{org_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "name": "LexAI Legal Group" }
```

---

### POST — Invite Member as Viewer (Admin/Manager)

```
POST {{base_url}}/orgs/{{org_id}}/invite
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "email": "viewer@example.com", "role": "viewer" }
```

---

### POST — Invite Member as Manager (Admin only)

```
POST {{base_url}}/orgs/{{org_id}}/invite
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "email": "manager@example.com", "role": "manager" }
```

Roles: `admin`, `manager`, `viewer` (default: `viewer`).

**Success (200):**
```json
{
  "success": true,
  "message": "Invitation sent to manager@example.com",
  "data": { "invitationId": "65f1a2b3c4d5e6f7a8b9c0d3", "expiresAt": "2026-05-14T10:00:00.000Z" }
}
```

---

### POST — Accept Invitation (Public)

```
POST {{base_url}}/orgs/{{org_id}}/invite/accept
Content-Type: application/json
```
```json
{ "token": "{{invite_token}}", "name": "New Member", "password": "Welcome@123" }
```
`name` and `password` only required if user has no existing account.

---

### PATCH — Change Member Role (Admin only)

```
PATCH {{base_url}}/orgs/{{org_id}}/members/{{target_user_id}}/role
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "role": "manager" }
```

---

### DELETE — Remove Member (Admin only)

```
DELETE {{base_url}}/orgs/{{org_id}}/members/{{target_user_id}}
Authorization: Bearer {{admin_token}}
```

---

## 5. Contracts — `/api/v1/contracts`

> `orgId` is resolved automatically from your token.

### POST — Create Contract (Any role)

```
POST {{base_url}}/contracts
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Minimal body:**
```json
{
  "title": "My NDA",
  "content": "This Non-Disclosure Agreement is made between Party A and Party B. Both parties agree to keep all shared information strictly confidential and not disclose it to any third party."
}
```

**Full body:**
```json
{
  "title": "Service Agreement 2026",
  "content": "This Service Agreement is entered into between Acme Corp (Service Provider) and Beta Ltd (Client). The Service Provider agrees to deliver software development services as outlined in Schedule A. Payment terms are net-30 from invoice date. Either party may terminate with 30 days written notice.",
  "type": "SaaS",
  "tags": ["legal", "2026", "saas"],
  "expiryDate": "2027-06-01",
  "jurisdiction": "India"
}
```

Field rules:
- `title` — required, 3–300 chars, no HTML
- `content` — required, min 50 chars
- `type` — optional: `NDA`, `Vendor`, `Employment`, `SaaS`, `Other` (default: `Other`)
- `tags` — optional array of strings
- `expiryDate` — optional, future date `YYYY-MM-DD`
- `jurisdiction` — optional free text

**Success (201):**
```json
{
  "success": true,
  "data": { "contract": { "id": "65f1a2b3c4d5e6f7a8b9c0d4", "title": "My NDA", "type": "NDA", "version": 1 } }
}
```
> Copy `data.contract.id` to `contract_id`.

---

### GET — List Contracts (Any role)

```
GET {{base_url}}/contracts
Authorization: Bearer {{access_token}}
```

**With filters:**
```
GET {{base_url}}/contracts?type=NDA&limit=5&sortBy=riskScore&order=desc
GET {{base_url}}/contracts?search=confidential&tag=legal&page=2
```

| Param | Default | Options |
|---|---|---|
| `page` | 1 | any number |
| `limit` | 10 | 1–50 |
| `type` | all | `NDA`, `Vendor`, `Employment`, `SaaS`, `Other` |
| `sortBy` | `createdAt` | `createdAt`, `title`, `type`, `riskScore`, `expiryDate` |
| `order` | `desc` | `asc`, `desc` |
| `tag` | none | any tag string |
| `search` | none | search in title (max 100 chars) |

---

### GET — Get Contract by ID (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{access_token}}
```

---

### PATCH — Update Contract (Admin/Manager)

```
PATCH {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "title": "Updated Service Agreement",
  "type": "Vendor",
  "tags": ["updated", "vendor", "2026"],
  "alertDays": [90, 30, 7],
  "expiryDate": "2027-12-01"
}
```
- `alertDays` — days before expiry to send alerts

---

### POST — Add New Version (Admin/Manager)

```
POST {{base_url}}/contracts/{{contract_id}}/versions
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "content": "This Non-Disclosure Agreement (revised v2) is made between Party A and Party B. Updated confidentiality terms apply from the date of signing. Penalty clause added for breach.",
  "changeNote": "Added penalty clause for breach of confidentiality"
}
```

---

### GET — List Versions (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}/versions
Authorization: Bearer {{access_token}}
```

---

### POST — Compare Two Versions (Any role)

```
POST {{base_url}}/contracts/{{contract_id}}/compare
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "versionA": 1, "versionB": 2 }
```
> AI diff result arrives via WebSocket `diff:complete` event.

---

### GET — Audit Trail (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}/audit
Authorization: Bearer {{access_token}}
```

---

### DELETE — Delete Contract (Admin/Manager)

```
DELETE {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{admin_token}}
```

---

## 6. Workflow Status — `/api/v1/contracts/:id/status`

**Valid statuses:** `draft` → `review` → `approved` → `signed` → `active` → `expired` / `terminated`

### GET — Get Contract Status (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "status": { "contractId": "...", "currentStatus": "draft", "updatedAt": "2026-05-07T10:00:00.000Z" }
  }
}
```

---

### PATCH — Update Status to Review (Admin/Manager)

```
PATCH {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{ "status": "review", "note": "Sending to legal team for review" }
```

---

### PATCH — Update Status to Approved (Admin only)

```
PATCH {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "status": "approved", "note": "Approved by legal counsel on 2026-05-07" }
```

---

### PATCH — Update Status to Signed (Admin only)

```
PATCH {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "status": "signed", "note": "Both parties signed on 2026-05-07" }
```

---

### PATCH — Update Status to Active (Admin only)

```
PATCH {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "status": "active", "note": "Contract is now active and enforceable" }
```

---

### PATCH — Terminate Contract (Admin only)

```
PATCH {{base_url}}/contracts/{{contract_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "status": "terminated", "note": "Terminated by mutual agreement" }
```

---

### GET — Get Status History (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}/status/history
Authorization: Bearer {{access_token}}
```

---

## 7. Comments — `/api/v1/contracts/:contractId/comments`

> Users can edit/delete their own comments. Admins can delete any comment.

### POST — Add Comment (Any role)

```
POST {{base_url}}/contracts/{{contract_id}}/comments
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "content": "Section 3.2 seems overly broad — we should narrow the indemnification scope to direct damages only." }
```
- `content` — required, 1–5000 chars

**Success (201):**
```json
{
  "success": true,
  "data": {
    "comment": { "_id": "65f1a2b3c4d5e6f7a8b9c0e1", "content": "...", "userId": "...", "createdAt": "2026-05-07T10:00:00.000Z" }
  }
}
```
> Copy `data.comment._id` to `comment_id`.

---

### GET — List Comments (Any role)

```
GET {{base_url}}/contracts/{{contract_id}}/comments
Authorization: Bearer {{access_token}}
```

**With pagination:**
```
GET {{base_url}}/contracts/{{contract_id}}/comments?page=1&limit=10
```

---

### PATCH — Edit Own Comment

```
PATCH {{base_url}}/contracts/{{contract_id}}/comments/{{comment_id}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "content": "Updated: Section 3.2 indemnification should be capped at contract value." }
```

---

### DELETE — Delete Own Comment

```
DELETE {{base_url}}/contracts/{{contract_id}}/comments/{{comment_id}}
Authorization: Bearer {{access_token}}
```

---

### DELETE — Delete Any Comment (Admin only)

```
DELETE {{base_url}}/contracts/{{contract_id}}/comments/{{comment_id}}
Authorization: Bearer {{admin_token}}
```

---

## 8. Analyses — `/api/v1/analyses`

### POST — Request AI Analysis (Any role)

```
POST {{base_url}}/analyses
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "contractId": "{{contract_id}}", "version": 1 }
```
`version` is optional — omit to analyse the latest version.

**Success — Queued (202):**
```json
{
  "success": true,
  "data": { "analysisId": "65f1a2b3c4d5e6f7a8b9c0d5", "status": "pending", "estimatedSeconds": 30 }
}
```
> Copy `data.analysisId` to `analysis_id`.

---

### GET — Get Analysis by ID (Any role)

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
      "status": "completed",
      "riskScore": 7.2,
      "summary": "This NDA contains standard confidentiality clauses with moderate risk.",
      "flags": ["missing_penalty_clause", "jurisdiction_mismatch"]
    }
  }
}
```

---

### GET — Get All Analyses for a Contract (Any role)

```
GET {{base_url}}/analyses/contract/{{contract_id}}
Authorization: Bearer {{access_token}}
```

---

### DELETE — Delete Single Analysis (Admin/Manager)

```
DELETE {{base_url}}/analyses/{{analysis_id}}
Authorization: Bearer {{admin_token}}
```

---

### DELETE — Delete All Analyses for a Contract (Admin/Manager)

```
DELETE {{base_url}}/analyses/contract/{{contract_id}}
Authorization: Bearer {{admin_token}}
```

---

## 9. AI Features — `/api/v1/ai`

> Rate-limited to **10 requests/min** per user.

### POST — Summarize a Clause

```
POST {{base_url}}/ai/summarize-clause
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{
  "clauseText": "The Receiving Party shall not disclose any Confidential Information to any third party without the prior written consent of the Disclosing Party for a period of five (5) years from the date of disclosure.",
  "contractType": "NDA"
}
```
- `clauseText` — required, 10–10,000 chars
- `contractType` — optional context

---

### POST — Ask a Question About a Contract

```
POST {{base_url}}/ai/ask
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{
  "contractId": "{{contract_id}}",
  "question": "What are my obligations if I breach the confidentiality clause?",
  "chatHistory": []
}
```
- `question` — required, 5–1,000 chars
- `chatHistory` — optional, max 20 prior turns

**Multi-turn example:**
```json
{
  "contractId": "{{contract_id}}",
  "question": "What is the notice period for termination?",
  "chatHistory": [
    { "role": "user", "content": "What are my obligations if I breach the confidentiality clause?" },
    { "role": "assistant", "content": "According to Clause 7, a breach may result in injunctive relief and monetary damages." }
  ]
}
```

---

### POST — Extract Key Terms

```
POST {{base_url}}/ai/extract-terms
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "contractId": "{{contract_id}}" }
```

---

### POST — Explain Risk Score

```
POST {{base_url}}/ai/explain-risk
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "analysisId": "{{analysis_id}}" }
```

---

### POST — Translate Analysis

```
POST {{base_url}}/ai/translate
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "analysisId": "{{analysis_id}}", "targetLanguage": "Hindi" }
```
- `targetLanguage` — required, e.g. `Spanish`, `Hindi`, `French`, `German`, `Chinese`

---

### POST — Compliance Check

```
POST {{base_url}}/ai/compliance
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{ "contractId": "{{contract_id}}", "framework": "GDPR" }
```
- `framework` — optional: `GDPR`, `HIPAA`, `SOX`, `PCI-DSS`, `CCPA`, `GENERAL` (default: `GDPR`)

---

### GET — AI Provider Status

```
GET {{base_url}}/ai/providers
Authorization: Bearer {{access_token}}
```

---

## 10. Notifications — `/api/v1/notifications`

### GET — List All Notifications (Any role)

```
GET {{base_url}}/notifications
Authorization: Bearer {{access_token}}
```

**With filters:**
```
GET {{base_url}}/notifications?read=false&limit=10
GET {{base_url}}/notifications?type=analysis_complete&page=1
```

| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 20 | 1–100 |
| `read` | all | `true` or `false` |
| `type` | all | notification type string |

---

### GET — Get Unread Count (Any role)

```
GET {{base_url}}/notifications/unread-count
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{ "success": true, "data": { "unreadCount": 5 } }
```

---

### GET — Get User-Specific Notifications (Any role)

```
GET {{base_url}}/notifications/user
Authorization: Bearer {{access_token}}
```

---

### PATCH — Mark Single Notification as Read (Any role)

```
PATCH {{base_url}}/notifications/{{notification_id}}/read
Authorization: Bearer {{access_token}}
```

---

### PATCH — Mark All Notifications as Read (Any role)

```
PATCH {{base_url}}/notifications/read-all
Authorization: Bearer {{access_token}}
```

---

### DELETE — Delete Notification (Any role)

```
DELETE {{base_url}}/notifications/{{notification_id}}
Authorization: Bearer {{access_token}}
```

---

## 11. Dashboard — `/api/v1/dashboard`

> All routes require auth + org membership.

### GET — Org Stats (Any role)

```
GET {{base_url}}/dashboard/stats
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalContracts": 24,
      "activeContracts": 18,
      "expiringSoon": 3,
      "totalAnalyses": 20,
      "averageRiskScore": 6.4,
      "pendingReview": 2
    }
  }
}
```

---

### GET — Risk Distribution (Any role)

```
GET {{base_url}}/dashboard/risk-distribution
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "distribution": {
      "low": 10,
      "medium": 8,
      "high": 4,
      "critical": 2
    }
  }
}
```

---

### GET — Expiry Timeline (Any role)

```
GET {{base_url}}/dashboard/expiry-timeline
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "timeline": {
      "next30Days": 2,
      "next60Days": 5,
      "next90Days": 8
    }
  }
}
```

---

### GET — Recent Activity (Any role)

```
GET {{base_url}}/dashboard/recent-activity
Authorization: Bearer {{access_token}}
```

**With limit:**
```
GET {{base_url}}/dashboard/recent-activity?limit=10
```

---

## 12. Tags — `/api/v1/tags`

### GET — List All Tags (Any role)

```
GET {{base_url}}/tags
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "tags": [
      { "tag": "legal", "count": 8 },
      { "tag": "2026", "count": 5 },
      { "tag": "nda", "count": 3 }
    ]
  }
}
```

---

### PATCH — Rename Tag (Admin/Manager)

```
PATCH {{base_url}}/tags/rename
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{ "oldTag": "legal", "newTag": "legal-reviewed" }
```
- Both tags: 1–50 chars, lowercase

---

### DELETE — Delete Tag from All Contracts (Admin/Manager)

```
DELETE {{base_url}}/tags/{{tag_name}}
Authorization: Bearer {{admin_token}}
```
> Removes the tag from every contract in the org. Set `tag_name` env var to e.g. `legal`.

---

## 13. Bookmarks — `/api/v1/bookmarks`

### POST — Bookmark a Contract (Any role)

```
POST {{base_url}}/bookmarks
Authorization: Bearer {{access_token}}
Content-Type: application/json
```
```json
{
  "contractId": "{{contract_id}}",
  "note": "Review this NDA before the Q3 board meeting"
}
```
- `contractId` — required, 24-char hex ObjectId
- `note` — optional, max 500 chars

---

### GET — List Bookmarks (Any role)

```
GET {{base_url}}/bookmarks
Authorization: Bearer {{access_token}}
```

**With pagination:**
```
GET {{base_url}}/bookmarks?page=1&limit=10
```

---

### DELETE — Remove Bookmark (Any role)

```
DELETE {{base_url}}/bookmarks/{{contract_id}}
Authorization: Bearer {{access_token}}
```

---

## 14. Templates — `/api/v1/templates`

### POST — Create Template (Admin/Manager)

```
POST {{base_url}}/templates
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "title": "Standard NDA Template",
  "description": "A standard mutual non-disclosure agreement for vendor onboarding",
  "content": "This Non-Disclosure Agreement is entered into between [PARTY A] and [PARTY B]. Both parties agree to maintain strict confidentiality of all shared information. This agreement is governed by the laws of [JURISDICTION] and remains in effect for [DURATION] years.",
  "type": "NDA",
  "category": "Legal",
  "tags": ["nda", "standard", "vendor"]
}
```
- `title` — required, 3–300 chars, no HTML
- `content` — required, min 10 chars
- `type` — optional: `NDA`, `Vendor`, `Employment`, `SaaS`, `Other` (default: `Other`)
- `category` — optional, max 100 chars (default: `General`)
- `tags` — optional, max 20 tags

---

### GET — List Templates (Any role)

```
GET {{base_url}}/templates
Authorization: Bearer {{access_token}}
```

**With filters:**
```
GET {{base_url}}/templates?type=NDA&category=Legal&search=vendor&limit=10
```

---

### GET — Get Template by ID (Any role)

```
GET {{base_url}}/templates/{{template_id}}
Authorization: Bearer {{access_token}}
```

---

### PATCH — Update Template (Admin/Manager)

```
PATCH {{base_url}}/templates/{{template_id}}
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "title": "Standard NDA Template v2",
  "description": "Updated with GDPR compliance clause",
  "tags": ["nda", "standard", "gdpr"]
}
```

---

### POST — Clone Template to Contract (Any role)

```
POST {{base_url}}/templates/{{template_id}}/clone
Authorization: Bearer {{access_token}}
```
> Creates a new contract pre-filled with the template content.

---

### DELETE — Delete Template (Admin/Manager)

```
DELETE {{base_url}}/templates/{{template_id}}
Authorization: Bearer {{admin_token}}
```

---

## 15. Share Links — `/api/v1/shares`

### POST — Create Share Link (Admin/Manager)

```
POST {{base_url}}/shares
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "contractId": "{{contract_id}}",
  "permissions": "view_content",
  "expiryHours": 72,
  "note": "Shared with external counsel for review"
}
```
- `permissions` — `view_metadata`, `view_content`, `view_analysis` (default: `view_metadata`)
- `expiryHours` — 1–720 (max 30 days, default: 72)
- `password` — optional, 4–128 chars
- `note` — optional, max 500 chars

**Success (201):**
```json
{
  "success": true,
  "data": {
    "shareLink": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0f1",
      "token": "abc123xyz...",
      "url": "http://localhost:3500/share/abc123xyz",
      "expiresAt": "2026-05-10T10:00:00.000Z"
    }
  }
}
```
> Copy `data.shareLink._id` to `share_link_id`.

---

### POST — Create Password-Protected Share Link (Admin/Manager)

```
POST {{base_url}}/shares
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{
  "contractId": "{{contract_id}}",
  "permissions": "view_analysis",
  "expiryHours": 168,
  "password": "SecureShare@99",
  "note": "Full analysis access for board review — password protected"
}
```

---

### GET — List Share Links for a Contract (Any role)

```
GET {{base_url}}/shares/contract/{{contract_id}}
Authorization: Bearer {{access_token}}
```

---

### DELETE — Revoke Share Link (Admin/Manager)

```
DELETE {{base_url}}/shares/{{share_link_id}}
Authorization: Bearer {{admin_token}}
```

---

## 16. Bulk Operations — `/api/v1/bulk`

> All bulk routes require **Admin or Manager** role.

### POST — Bulk Add Tags (Admin/Manager)

```
POST {{base_url}}/bulk/add-tags
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "contractIds": ["{{contract_id}}", "65f1a2b3c4d5e6f7a8b9c0d9"],
  "tags": ["q2-review", "priority"]
}
```
- `contractIds` — 1–100 contract ObjectIds
- `tags` — 1–20 tags, max 50 chars each

---

### POST — Bulk Remove Tags (Admin/Manager)

```
POST {{base_url}}/bulk/remove-tags
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "contractIds": ["{{contract_id}}", "65f1a2b3c4d5e6f7a8b9c0d9"],
  "tags": ["q2-review"]
}
```

---

### POST — Bulk Update Contract Type (Admin/Manager)

```
POST {{base_url}}/bulk/update-type
Authorization: Bearer {{manager_token}}
Content-Type: application/json
```
```json
{
  "contractIds": ["{{contract_id}}", "65f1a2b3c4d5e6f7a8b9c0d9"],
  "type": "Vendor"
}
```
- `type` — one of: `NDA`, `Vendor`, `Employment`, `SaaS`, `Other`

---

### POST — Bulk Delete Contracts (Admin/Manager)

```
POST {{base_url}}/bulk/delete
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{
  "contractIds": ["65f1a2b3c4d5e6f7a8b9c0d9", "65f1a2b3c4d5e6f7a8b9c0da"]
}
```
- `contractIds` — 1–50 contract ObjectIds (soft-delete)

---

## 17. Preferences — `/api/v1/preferences`

> User-scoped — no org required.

### GET — Get My Preferences (Any role)

```
GET {{base_url}}/preferences
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "notifications": { "emailOnAnalysisComplete": true, "emailOnContractExpiring": true },
      "display": { "contractsPerPage": 10, "defaultSortBy": "createdAt", "showRiskBadges": true },
      "defaults": { "contractType": "NDA", "alertDays": [30, 7] },
      "timezone": "Asia/Kolkata"
    }
  }
}
```

---

### PUT — Update Preferences (Any role)

```
PUT {{base_url}}/preferences
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Notification preferences:**
```json
{
  "notifications": {
    "emailOnAnalysisComplete": true,
    "emailOnContractExpiring": true,
    "emailOnCommentAdded": false,
    "emailOnInvitation": true,
    "pushOnAnalysisComplete": true,
    "pushOnContractExpiring": true,
    "pushOnCommentAdded": false
  }
}
```

**Display preferences:**
```json
{
  "display": {
    "contractsPerPage": 25,
    "defaultSortBy": "riskScore",
    "defaultSortOrder": "desc",
    "showRiskBadges": true
  }
}
```

**Default preferences:**
```json
{
  "defaults": {
    "contractType": "NDA",
    "alertDays": [90, 30, 7]
  },
  "timezone": "Asia/Kolkata"
}
```

---

### DELETE — Reset Preferences to Defaults (Any role)

```
DELETE {{base_url}}/preferences
Authorization: Bearer {{access_token}}
```

---

## 18. Export — `/api/v1/exports`

### GET — Export Contracts List (Any role)

```
GET {{base_url}}/exports/contracts
Authorization: Bearer {{access_token}}
```

**With filters:**
```
GET {{base_url}}/exports/contracts?type=NDA&tag=legal
```

---

### GET — Export Contract Report (Any role)

```
GET {{base_url}}/exports/contracts/{{contract_id}}/report
Authorization: Bearer {{access_token}}
```
> Returns full contract + latest analysis as a downloadable JSON report.

---

### GET — Export Analyses Summary (Any role)

```
GET {{base_url}}/exports/analyses
Authorization: Bearer {{access_token}}
```

---

## 19. Reports — `/api/v1/reports`

### GET — Compliance Report (Any role)

```
GET {{base_url}}/reports/compliance
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "report": {
      "totalContracts": 24,
      "analysedContracts": 20,
      "coveragePercent": 83,
      "expiredContracts": 2,
      "highRiskContracts": 4
    }
  }
}
```

---

### GET — Risk Trend Report (Any role)

```
GET {{base_url}}/reports/risk-trend
Authorization: Bearer {{access_token}}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "report": {
      "months": ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
      "averageRiskScores": [5.2, 5.8, 6.1, 6.4, 7.0, 6.8]
    }
  }
}
```

---

### GET — Activity Report (Any role)

```
GET {{base_url}}/reports/activity
Authorization: Bearer {{access_token}}
```

---

## 20. Enrichment — `/api/v1/enrichment`

> Auth required. External APIs — gracefully degrade on failure.

### GET — Country Info

```
GET {{base_url}}/enrichment/country/India
Authorization: Bearer {{access_token}}
```

---

### GET — World Time by Timezone

```
GET {{base_url}}/enrichment/time/Asia/Kolkata
Authorization: Bearer {{access_token}}
```

---

### GET — Check Holiday

```
GET {{base_url}}/enrichment/holidays?country=IN&date=2026-08-15
Authorization: Bearer {{access_token}}
```

---

### GET — Public Holidays for a Year

```
GET {{base_url}}/enrichment/holidays/IN/2026
Authorization: Bearer {{access_token}}
```

---

### GET — IP Geolocation

```
GET {{base_url}}/enrichment/ip/8.8.8.8
Authorization: Bearer {{access_token}}
```

---

### GET — Validate Email

```
GET {{base_url}}/enrichment/email/validate?email=vishal@example.com
Authorization: Bearer {{access_token}}
```

---

### GET — Email Reputation

```
GET {{base_url}}/enrichment/email/reputation?email=vishal@example.com
Authorization: Bearer {{access_token}}
```

---

### GET — Email Breach Check

```
GET {{base_url}}/enrichment/email/breaches?email=vishal@example.com
Authorization: Bearer {{access_token}}
```
> Requires `HIBP_API_KEY` in `.env`.

---

### GET — Currency Exchange Rate

```
GET {{base_url}}/enrichment/currency/rate?from=USD&to=INR
Authorization: Bearer {{access_token}}
```

---

### GET — Multiple Currency Rates

```
GET {{base_url}}/enrichment/currency/rates?base=USD&targets=INR,EUR,GBP
Authorization: Bearer {{access_token}}
```

---

## 21. Admin Panel — `/api/v1/admin`

> **ALL routes require `Authorization: Bearer {{admin_token}}`**
> Rate-limited: 5 requests / 15 minutes (strict).

---

### GET — Platform-Wide Stats

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
      "totalUsers": 142,
      "totalOrgs": 18,
      "totalContracts": 534,
      "totalAnalyses": 489,
      "analysesLast30Days": 67,
      "averageRiskScore": 6.2,
      "queueDepth": 3
    }
  }
}
```

---

### GET — RabbitMQ Queue Status

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
      "name": "analysis_queue",
      "messageCount": 3,
      "consumerCount": 1,
      "dlxMessageCount": 0
    }
  }
}
```

---

### GET — List All Users (Paginated)

```
GET {{base_url}}/admin/users
Authorization: Bearer {{admin_token}}
```

**With pagination:**
```
GET {{base_url}}/admin/users?page=1&limit=20
```

---

### POST — Create User Directly (No OTP)

```
POST {{base_url}}/admin/users
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

**Create an admin user:**
```json
{
  "name": "Super Admin",
  "email": "superadmin@lexai.com",
  "password": "AdminPass@123",
  "role": "admin"
}
```

**Create a manager user:**
```json
{
  "name": "Legal Manager",
  "email": "manager@lexai.com",
  "password": "ManagerPass@123",
  "role": "manager"
}
```

**Create a viewer user:**
```json
{
  "name": "John Viewer",
  "email": "viewer@lexai.com",
  "password": "ViewerPass@123",
  "role": "viewer"
}
```

- `name`, `email`, `password`, `role` — all required
- `role` — one of: `admin`, `manager`, `viewer`
- User is created pre-verified (no OTP flow)

**Success (201):**
```json
{
  "success": true,
  "message": "User created successfully.",
  "data": { "user": { "_id": "...", "name": "Legal Manager", "email": "manager@lexai.com", "role": "manager", "isActive": true } }
}
```

---

### PATCH — Update User Role

```
PATCH {{base_url}}/admin/users/{{target_user_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "role": "manager" }
```

---

### PATCH — Update User Name

```
PATCH {{base_url}}/admin/users/{{target_user_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "name": "Updated Name" }
```

---

### PATCH — Deactivate User (Soft Delete)

```
PATCH {{base_url}}/admin/users/{{target_user_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "isActive": false }
```

---

### PATCH — Reactivate User

```
PATCH {{base_url}}/admin/users/{{target_user_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```
```json
{ "isActive": true }
```

---

### DELETE — Deactivate User Account

```
DELETE {{base_url}}/admin/users/{{target_user_id}}
Authorization: Bearer {{admin_token}}
```

---

### DELETE — Force-Revoke All Sessions for a User

```
DELETE {{base_url}}/admin/users/{{target_user_id}}/sessions
Authorization: Bearer {{admin_token}}
```
> Immediately invalidates all active sessions for the target user.

---

### DELETE — Hard-Delete Any Contract (Platform-Wide)

```
DELETE {{base_url}}/admin/contracts/{{contract_id}}
Authorization: Bearer {{admin_token}}
```
> Permanently deletes the contract regardless of org. Decrements org contract count.

---

### DELETE — Delete Organization + Cascade

```
DELETE {{base_url}}/admin/organizations/{{org_id}}
Authorization: Bearer {{admin_token}}
```
> Cascades: soft-deletes all contracts, hard-deletes all analyses, clears user memberships, then deletes the org.

---

### DELETE — Hard-Delete Any Analysis (Platform-Wide)

```
DELETE {{base_url}}/admin/analyses/{{analysis_id}}
Authorization: Bearer {{admin_token}}
```

---

### DELETE — Soft-Delete Any Template (Including Global)

```
DELETE {{base_url}}/admin/templates/{{template_id}}
Authorization: Bearer {{admin_token}}
```

---

### DELETE — Hard-Delete Any Comment (Platform-Wide)

```
DELETE {{base_url}}/admin/comments/{{comment_id}}
Authorization: Bearer {{admin_token}}
```

---

### GET — Global Audit Logs

```
GET {{base_url}}/admin/audit-logs
Authorization: Bearer {{admin_token}}
```

**With pagination:**
```
GET {{base_url}}/admin/audit-logs?page=1&limit=50
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      { "action": "admin.contract.deleted", "userId": "...", "resourceType": "Contract", "resourceId": "...", "timestamp": "2026-05-07T10:00:00Z" },
      { "action": "admin.user.sessions.revoked", "userId": "...", "resourceType": "User", "resourceId": "...", "timestamp": "2026-05-07T09:45:00Z" }
    ],
    "meta": { "total": 320, "page": 1, "limit": 50, "totalPages": 7 }
  }
}
```

---

## Testing Order (Recommended)

Follow this sequence to test all APIs end-to-end:

1. **Health Check** — verify server is up
2. **Auth: Register** → **Verify Email** → **Login** (save `access_token`, `user_id`)
3. **Admin: Create Users** — create admin, manager, viewer accounts directly
4. **Auth: Login as Admin** (save `admin_token`), **Login as Manager** (save `manager_token`)
5. **Orgs: Create Org** (save `org_id`) → **Invite Members** → **Accept Invite**
6. **Contracts: Create** (save `contract_id`) → **List** → **Get** → **Update** → **Add Version** → **Compare**
7. **Status: Update** through lifecycle (draft → review → approved → signed → active)
8. **Analyses: Request** (save `analysis_id`) → **Get** → wait for WebSocket completion
9. **AI: Summarize Clause** → **Ask Question** → **Extract Terms** → **Explain Risk** → **Compliance Check**
10. **Comments: Add** (save `comment_id`) → **List** → **Edit** → **Delete**
11. **Tags: List** → **Rename** → **Delete**
12. **Bookmarks: Add** → **List** → **Remove**
13. **Templates: Create** (save `template_id`) → **List** → **Get** → **Clone** → **Update** → **Delete**
14. **Shares: Create** (save `share_link_id`) → **List** → **Revoke**
15. **Bulk: Add Tags** → **Remove Tags** → **Update Type** → **Delete**
16. **Preferences: Get** → **Update** → **Reset**
17. **Dashboard: Stats** → **Risk Distribution** → **Expiry Timeline** → **Recent Activity**
18. **Reports: Compliance** → **Risk Trend** → **Activity**
19. **Exports: Contracts** → **Contract Report** → **Analyses**
20. **Enrichment: Country** → **Time** → **Holidays** → **Currency Rate**
21. **Notifications: List** → **Unread Count** → **Mark Read** → **Mark All Read** → **Delete**
22. **Admin: Stats** → **Queue Status** → **List Users** → **Audit Logs** → **Delete Resources**

---

## Common Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body or params |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient role (e.g. viewer trying admin action) |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `DUPLICATE_EMAIL` | Email already registered |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 503 | `SERVICE_UNAVAILABLE` | Downstream service (AI, queue) unavailable |

**Error response shape:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

---

## 22. WebSocket API — Socket.io

> **Connection URL:** `ws://localhost:3500`
> **Library:** Socket.io v4 (use the `socket.io-client` package or Postman's WebSocket tab)
> **Transport:** WebSocket (falls back to HTTP long-polling)

Socket.io is used for all real-time push events. The server never polls — it pushes events to connected clients as things happen.

---

### Connection & Authentication

Authentication uses the same PASETO access token as the REST API. Pass it in the `auth` object during the handshake:

**JavaScript (socket.io-client):**
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500', {
  auth: { token: '{{access_token}}' },   // or 'Bearer {{access_token}}'
  transports: ['websocket'],
});

socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('connect_error', (err) => console.error('Auth failed:', err.message));
```

**Postman WebSocket tab:**
```
URL: ws://localhost:3500/socket.io/?EIO=4&transport=websocket
```
Add header: `Authorization: Bearer {{access_token}}`

On successful connection the server automatically joins the socket to `user:<userId>`. If the user is an admin, they are also joined to the `admin` room.

---

### Room Architecture

| Room | Who joins | Used for |
|---|---|---|
| `user:<userId>` | Auto on connect | Personal events (analysis, diff, quota, notifications) |
| `org:<orgId>` | Client sends `join:org` | Org-wide events (contracts, comments, membership) |
| `admin` | Auto for admin role | Platform-wide admin events |

---

### Client → Server Events

#### `join:org`

Join the org room to receive org-wide broadcasts. You can only join your own org (cross-org is blocked server-side).

```js
socket.emit('join:org', { orgId: '{{org_id}}' });
```

**Error response (if unauthorized):**
```json
{ "message": "You can only join your own organization room." }
```

---

### Server → Client Events

All events follow the shape: `socket.on('<event>', (payload) => { ... })`

---

#### Analysis Events — room: `user:<userId>`

##### `analysis:complete`
Fired when an AI analysis job finishes successfully.

```js
socket.on('analysis:complete', (data) => {
  console.log(data);
});
```
```json
{
  "analysisId": "65f1a2b3c4d5e6f7a8b9c0d5",
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "status": "completed",
  "riskScore": 7.2,
  "summary": "This NDA contains standard confidentiality clauses with moderate risk."
}
```

##### `analysis:failed`
Fired when an AI analysis job fails after all retries.

```js
socket.on('analysis:failed', (data) => {
  console.log(data);
});
```
```json
{
  "analysisId": "65f1a2b3c4d5e6f7a8b9c0d5",
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "error": "AI provider unavailable after 3 retries"
}
```

---

#### Diff Events — room: `user:<userId>`

##### `diff:complete`
Fired when a version comparison + AI explanation is ready. Triggered after `POST /contracts/:id/compare`.

```js
socket.on('diff:complete', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "versionA": 1,
  "versionB": 2,
  "diffId": "65f1a2b3c4d5e6f7a8b9c0e9",
  "summary": "Version 2 adds a penalty clause and updates the jurisdiction to India."
}
```

##### `diff:failed`
Fired when the diff AI explanation job fails.

```js
socket.on('diff:failed', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "versionA": 1,
  "versionB": 2,
  "error": "AI provider timeout"
}
```

---

#### Contract Events — room: `org:<orgId>`

> Requires joining the org room first via `join:org`.

##### `contract:uploaded`
Fired when any org member uploads a new contract.

```js
socket.on('contract:uploaded', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "title": "Service Agreement 2026",
  "type": "SaaS",
  "uploadedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

##### `contract:updated`
Fired when a contract's metadata is updated (title, tags, alertDays, etc.).

```js
socket.on('contract:updated', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "title": "Service Agreement 2026 (Revised)",
  "updatedBy": "65f1a2b3c4d5e6f7a8b9c0d1",
  "changes": ["title", "tags"]
}
```

##### `contract:deleted`
Fired when a contract is soft-deleted.

```js
socket.on('contract:deleted', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "title": "Service Agreement 2026",
  "deletedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

##### `contract:expiring`
Fired by the expiry cron job when a contract is approaching its expiry date.

```js
socket.on('contract:expiring', (data) => {
  console.log(data);
});
```
```json
{
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "title": "Vendor Agreement",
  "expiresAt": "2026-06-01T00:00:00.000Z",
  "daysRemaining": 25
}
```

---

#### Comment Events — room: `org:<orgId>`

> Enables real-time collaborative annotation on contracts.

##### `comment:created`

```js
socket.on('comment:created', (data) => {
  console.log(data);
});
```
```json
{
  "commentId": "65f1a2b3c4d5e6f7a8b9c0e1",
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "userId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "content": "Section 3.2 seems overly broad.",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

##### `comment:updated`

```js
socket.on('comment:updated', (data) => {
  console.log(data);
});
```
```json
{
  "commentId": "65f1a2b3c4d5e6f7a8b9c0e1",
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "userId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "content": "Updated: Section 3.2 indemnification should be capped at contract value.",
  "updatedAt": "2026-05-07T10:05:00.000Z"
}
```

##### `comment:deleted`

```js
socket.on('comment:deleted', (data) => {
  console.log(data);
});
```
```json
{
  "commentId": "65f1a2b3c4d5e6f7a8b9c0e1",
  "contractId": "65f1a2b3c4d5e6f7a8b9c0d4",
  "deletedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

#### Membership Events — room: `org:<orgId>`

##### `member:invited`
Fired when an admin/manager sends an invitation.

```js
socket.on('member:invited', (data) => {
  console.log(data);
});
```
```json
{
  "email": "newmember@example.com",
  "role": "viewer",
  "invitedBy": "65f1a2b3c4d5e6f7a8b9c0d1",
  "invitationId": "65f1a2b3c4d5e6f7a8b9c0f2"
}
```

##### `member:joined`
Fired when an invited user accepts and joins the org.

```js
socket.on('member:joined', (data) => {
  console.log(data);
});
```
```json
{
  "userId": "65f1a2b3c4d5e6f7a8b9c0d8",
  "name": "New Member",
  "email": "newmember@example.com",
  "role": "viewer"
}
```

##### `member:removed`
Fired when a member is removed from the org.

```js
socket.on('member:removed', (data) => {
  console.log(data);
});
```
```json
{
  "userId": "65f1a2b3c4d5e6f7a8b9c0d8",
  "removedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

##### `member:role_changed`
Fired when an admin changes a member's role.

```js
socket.on('member:role_changed', (data) => {
  console.log(data);
});
```
```json
{
  "userId": "65f1a2b3c4d5e6f7a8b9c0d8",
  "newRole": "manager",
  "changedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

#### Bulk Operation Events — room: `user:<userId>`

##### `bulk:complete`
Fired when a bulk operation (add tags, remove tags, update type, delete) finishes.

```js
socket.on('bulk:complete', (data) => {
  console.log(data);
});
```
```json
{
  "operation": "bulk_add_tags",
  "modifiedCount": 5,
  "contractIds": ["65f1a2b3c4d5e6f7a8b9c0d4", "65f1a2b3c4d5e6f7a8b9c0d9"]
}
```

##### `bulk:failed`

```js
socket.on('bulk:failed', (data) => {
  console.log(data);
});
```
```json
{
  "operation": "bulk_delete",
  "error": "One or more contracts not found"
}
```

---

#### Quota Events — room: `user:<userId>`

##### `quota:warning`
Fired when a user approaches their plan's contract or analysis limit.

```js
socket.on('quota:warning', (data) => {
  console.log(data);
});
```
```json
{
  "used": 9,
  "limit": 10,
  "percentage": 90,
  "resourceType": "contracts"
}
```

---

#### Notification Events — room: `user:<userId>`

##### `new_notification`
Fired when a new in-app notification is created for the user.

```js
socket.on('new_notification', (notification) => {
  console.log(notification);
});
```
```json
{
  "_id": "65f1a2b3c4d5e6f7a8b9c0f3",
  "type": "analysis_complete",
  "title": "Analysis Ready",
  "message": "Your analysis for 'Service Agreement 2026' is complete.",
  "read": false,
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

#### Admin Events — room: `admin`

> Only received by users with `role: admin`.

##### `admin:stats_updated`
Fired periodically or after significant platform events to refresh the admin dashboard.

```js
socket.on('admin:stats_updated', (data) => {
  console.log(data);
});
```
```json
{
  "totalUsers": 142,
  "totalOrgs": 38,
  "totalContracts": 1204,
  "queueDepth": 3,
  "analysesLast30Days": 87
}
```

##### `admin:user_deactivated`
Fired when an admin deactivates a user account.

```js
socket.on('admin:user_deactivated', (data) => {
  console.log(data);
});
```
```json
{
  "userId": "65f1a2b3c4d5e6f7a8b9c0d8",
  "email": "user@example.com",
  "deactivatedBy": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

### Complete Client Setup Example

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500', {
  auth: { token: localStorage.getItem('access_token') },
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// ── Connection lifecycle ──────────────────────────────────────
socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);

  // Join org room for org-wide events
  socket.emit('join:org', { orgId: MY_ORG_ID });
});

socket.on('disconnect', (reason) => console.warn('Disconnected:', reason));
socket.on('connect_error', (err) => console.error('Connection error:', err.message));

// ── Analysis ─────────────────────────────────────────────────
socket.on('analysis:complete', ({ analysisId, riskScore, summary }) => {
  showToast(`Analysis complete — Risk score: ${riskScore}`);
  refreshAnalysisUI(analysisId);
});

socket.on('analysis:failed', ({ analysisId, error }) => {
  showToast(`Analysis failed: ${error}`, 'error');
});

// ── Diff ─────────────────────────────────────────────────────
socket.on('diff:complete', ({ diffId, summary }) => {
  showToast('Version comparison ready');
  openDiffPanel(diffId);
});

// ── Contracts ────────────────────────────────────────────────
socket.on('contract:uploaded', ({ contractId, title }) => {
  showToast(`New contract uploaded: ${title}`);
  refreshContractList();
});

socket.on('contract:updated', ({ contractId, changes }) => {
  refreshContract(contractId);
});

socket.on('contract:deleted', ({ contractId }) => {
  removeContractFromUI(contractId);
});

socket.on('contract:expiring', ({ title, daysRemaining }) => {
  showBanner(`⚠️ "${title}" expires in ${daysRemaining} days`);
});

// ── Comments ─────────────────────────────────────────────────
socket.on('comment:created', (comment) => appendComment(comment));
socket.on('comment:updated', (comment) => updateCommentInUI(comment));
socket.on('comment:deleted', ({ commentId }) => removeCommentFromUI(commentId));

// ── Membership ───────────────────────────────────────────────
socket.on('member:joined', ({ name }) => showToast(`${name} joined the org`));
socket.on('member:removed', ({ userId }) => removeUserFromMemberList(userId));
socket.on('member:role_changed', ({ userId, newRole }) => updateMemberRole(userId, newRole));

// ── Bulk ops ─────────────────────────────────────────────────
socket.on('bulk:complete', ({ operation, modifiedCount }) => {
  showToast(`${operation} completed — ${modifiedCount} contracts updated`);
});

// ── Quota ────────────────────────────────────────────────────
socket.on('quota:warning', ({ percentage, resourceType }) => {
  showBanner(`⚠️ You've used ${percentage}% of your ${resourceType} quota`);
});

// ── Notifications ────────────────────────────────────────────
socket.on('new_notification', (notification) => {
  incrementNotificationBadge();
  showToast(notification.message);
});
```

---

### Event Summary Table

| Event | Room | Triggered by |
|---|---|---|
| `analysis:complete` | `user:<userId>` | Worker finishes AI analysis |
| `analysis:failed` | `user:<userId>` | Worker exhausts retries |
| `diff:complete` | `user:<userId>` | Worker finishes diff AI explanation |
| `diff:failed` | `user:<userId>` | Diff worker fails |
| `contract:uploaded` | `org:<orgId>` | `POST /contracts` |
| `contract:updated` | `org:<orgId>` | `PATCH /contracts/:id` |
| `contract:deleted` | `org:<orgId>` | `DELETE /contracts/:id` |
| `contract:expiring` | `org:<orgId>` | Expiry cron job |
| `comment:created` | `org:<orgId>` | `POST /contracts/:id/comments` |
| `comment:updated` | `org:<orgId>` | `PATCH /contracts/:id/comments/:id` |
| `comment:deleted` | `org:<orgId>` | `DELETE /contracts/:id/comments/:id` |
| `member:invited` | `org:<orgId>` | `POST /orgs/:id/invite` |
| `member:joined` | `org:<orgId>` | `POST /orgs/:id/invite/accept` |
| `member:removed` | `org:<orgId>` | `DELETE /orgs/:id/members/:userId` |
| `member:role_changed` | `org:<orgId>` | `PATCH /orgs/:id/members/:userId/role` |
| `bulk:complete` | `user:<userId>` | `POST /bulk/*` |
| `bulk:failed` | `user:<userId>` | Bulk operation error |
| `quota:warning` | `user:<userId>` | Quota service threshold check |
| `new_notification` | `user:<userId>` | Notification worker |
| `admin:stats_updated` | `admin` | Admin stats refresh |
| `admin:user_deactivated` | `admin` | `DELETE /admin/users/:id` |
