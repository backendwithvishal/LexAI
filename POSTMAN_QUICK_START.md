# LexAI API — Quick Start Guide for Postman

> **Base URL:** `http://localhost:3500/api/v1`

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Postman Environment

1. Open Postman → Click **Environments** (left sidebar)
2. Click **+** to create new environment
3. Name it: `LexAI Local`
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3500/api/v1` | `http://localhost:3500/api/v1` |
| `access_token` | *(leave empty)* | *(auto-filled after login)* |
| `org_id` | *(leave empty)* | *(auto-filled after create org)* |
| `contract_id` | *(leave empty)* | *(auto-filled after upload)* |

5. Click **Save**
6. Select `LexAI Local` from the environment dropdown (top right)

---

## 📋 Essential Endpoints (Copy & Paste Ready)

### 1️⃣ Register New User

```
POST {{base_url}}/auth/register
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "Test@123456"
}
```

**Response:** Copy the `otp` from response (dev mode only)

---

### 2️⃣ Verify Email

```
POST {{base_url}}/auth/verify-email
Content-Type: application/json
```

**Body:**
```json
{
  "email": "test@example.com",
  "otp": "PASTE_OTP_HERE"
}
```

---

### 3️⃣ Login

```
POST {{base_url}}/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "test@example.com",
  "password": "Test@123456"
}
```

**After Success:**
1. Copy `data.accessToken` from response
2. Go to Environment → Set `access_token` = `PASTE_TOKEN_HERE`
3. Save environment

---

### 4️⃣ Create Organization

```
POST {{base_url}}/orgs
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "My Company"
}
```

**After Success:**
1. Copy `data.org.id` from response
2. Go to Environment → Set `org_id` = `PASTE_ORG_ID_HERE`
3. Save environment

---

### 5️⃣ Upload Contract

```
POST {{base_url}}/contracts
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Test NDA Agreement",
  "content": "This Non-Disclosure Agreement is made between Party A and Party B. Both parties agree to keep all shared information strictly confidential and not disclose it to any third party. This agreement is valid for 5 years from the date of signing.",
  "type": "NDA",
  "tags": ["test", "nda"]
}
```

**After Success:**
1. Copy `data.contract.id` from response
2. Go to Environment → Set `contract_id` = `PASTE_CONTRACT_ID_HERE`
3. Save environment

---

### 6️⃣ Request AI Analysis

```
POST {{base_url}}/analyses
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "contractId": "{{contract_id}}"
}
```

**Response:** Copy `data.analysisId` — analysis runs in background, result comes via WebSocket

---

### 7️⃣ Get Analysis Result

```
GET {{base_url}}/analyses/PASTE_ANALYSIS_ID_HERE
Authorization: Bearer {{access_token}}
```

Replace `PASTE_ANALYSIS_ID_HERE` with the ID from step 6.

---

### 8️⃣ List All Contracts

```
GET {{base_url}}/contracts
Authorization: Bearer {{access_token}}
```

**With filters:**
```
GET {{base_url}}/contracts?type=NDA&limit=10&sortBy=createdAt&order=desc
```

---

### 9️⃣ Get My Profile

```
GET {{base_url}}/users/me
Authorization: Bearer {{access_token}}
```

---

### 🔟 Dashboard Stats

```
GET {{base_url}}/dashboard/stats
Authorization: Bearer {{access_token}}
```

---

## 🔐 Authentication Headers

For **all protected endpoints**, add this header:

```
Authorization: Bearer {{access_token}}
```

Postman will auto-replace `{{access_token}}` with your saved token.

---

## 📊 Common Query Parameters

### Pagination
```
?page=1&limit=10
```

### Sorting
```
?sortBy=createdAt&order=desc
```
Options: `createdAt`, `title`, `riskScore`, `expiryDate`

### Filtering
```
?type=NDA&tag=legal&search=confidential
```

---

## 🎯 Quick Test Flow (5 minutes)

1. **Register** → Copy OTP
2. **Verify Email** → Paste OTP
3. **Login** → Save `access_token`
4. **Create Org** → Save `org_id`
5. **Upload Contract** → Save `contract_id`
6. **Request Analysis** → Wait 30 seconds
7. **Get Analysis** → See AI results
8. **List Contracts** → See your uploaded contract

---

## 🔥 Advanced Endpoints

### Add Comment to Contract

```
POST {{base_url}}/contracts/{{contract_id}}/comments
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "content": "This clause needs review by legal team"
}
```

---

### Invite Team Member

```
POST {{base_url}}/orgs/{{org_id}}/invite
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "email": "teammate@example.com",
  "role": "viewer"
}
```

Roles: `admin`, `manager`, `viewer`

---

### Update Contract Metadata

```
PATCH {{base_url}}/contracts/{{contract_id}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Updated NDA Agreement",
  "tags": ["legal", "updated", "2026"]
}
```

---

### Bulk Add Tags

```
POST {{base_url}}/bulk/add-tags
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "contractIds": ["{{contract_id}}"],
  "tags": ["urgent", "q2-review"]
}
```

---

### AI Ask Question

```
POST {{base_url}}/ai/ask
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "contractId": "{{contract_id}}",
  "question": "What are my obligations under this agreement?"
}
```

---

### Create Share Link

```
POST {{base_url}}/shares
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "contractId": "{{contract_id}}",
  "permissions": "view_content",
  "expiryHours": 72
}
```

---

## 🌐 WebSocket Connection (Socket.io)

### JavaScript Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500', {
  auth: { token: 'YOUR_ACCESS_TOKEN_HERE' },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Join your org room for org-wide events
  socket.emit('join:org', { orgId: 'YOUR_ORG_ID_HERE' });
});

// Listen for analysis completion
socket.on('analysis:complete', (data) => {
  console.log('Analysis done!', data);
});

// Listen for new contracts
socket.on('contract:uploaded', (data) => {
  console.log('New contract uploaded:', data);
});

// Listen for comments
socket.on('comment:created', (data) => {
  console.log('New comment:', data);
});
```

### Key Events

| Event | When | Room |
|-------|------|------|
| `analysis:complete` | AI analysis finishes | `user:<userId>` |
| `contract:uploaded` | New contract added | `org:<orgId>` |
| `comment:created` | Comment added | `org:<orgId>` |
| `member:joined` | New member joins | `org:<orgId>` |
| `quota:warning` | Approaching limit | `user:<userId>` |

---

## ❌ Common Errors

### 401 Unauthorized
**Fix:** Your token expired. Login again and update `access_token`.

### 403 Forbidden
**Fix:** Your role doesn't have permission. Check if you need `admin` or `manager` role.

### 404 Not Found
**Fix:** Check the ID in the URL. Make sure you saved it to environment variables.

### 400 Validation Error
**Fix:** Check the request body format. All fields must match the examples above.

---

## 🎨 Postman Tips

### Auto-Save Variables

Add this to **Tests** tab (after login/create org/upload contract):

```javascript
// Auto-save access token after login
if (pm.response.json().data?.accessToken) {
  pm.environment.set("access_token", pm.response.json().data.accessToken);
}

// Auto-save org ID after create org
if (pm.response.json().data?.org?.id) {
  pm.environment.set("org_id", pm.response.json().data.org.id);
}

// Auto-save contract ID after upload
if (pm.response.json().data?.contract?.id) {
  pm.environment.set("contract_id", pm.response.json().data.contract.id);
}
```

### Pre-Request Script (Auto-Add Auth Header)

Add this to **Collection** → **Pre-request Script**:

```javascript
if (pm.environment.get("access_token")) {
  pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get("access_token")
  });
}
```

---

## 📦 Import Ready-Made Collection

If you have `LexAI.postman_collection.json` in your project:

1. Open Postman
2. Click **Import** (top left)
3. Drag `LexAI.postman_collection.json` into the window
4. Click **Import**
5. All endpoints are ready to use!

---

## 🔄 Testing Workflow

### Basic Flow (5 min)
```
Register → Verify → Login → Create Org → Upload Contract → Done
```

### Full Flow (15 min)
```
Register → Verify → Login → Create Org → 
Upload Contract → Request Analysis → Get Analysis → 
Add Comment → Invite Member → Create Share Link → Done
```

### Admin Flow
```
Login as Admin → Get Stats → List Users → 
Create User → Deactivate User → View Audit Logs
```

---

## 🆘 Need Help?

### Check Server Status
```
GET http://localhost:3500/health
```

Should return:
```json
{
  "status": "ok",
  "services": {
    "mongodb": "up",
    "redis": "up",
    "rabbitmq": "up"
  }
}
```

### View Logs
Check your terminal where the server is running for detailed error messages.

---

## 🎯 Pro Tips

1. **Save time:** Use Postman's **Collection Runner** to run multiple requests in sequence
2. **Test faster:** Use **Environments** to switch between dev/staging/prod
3. **Debug easier:** Enable **Postman Console** (View → Show Postman Console) to see all requests
4. **Organize better:** Create folders in your collection: Auth, Contracts, Analysis, Admin
5. **Share with team:** Export collection and environment, commit to git

---

## 📝 Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ LexAI API Quick Reference                               │
├─────────────────────────────────────────────────────────┤
│ Base URL: http://localhost:3500/api/v1                 │
│                                                         │
│ Auth:                                                   │
│   POST /auth/register        → Register                │
│   POST /auth/verify-email    → Verify                  │
│   POST /auth/login           → Login (get token)       │
│                                                         │
│ Contracts:                                              │
│   POST   /contracts          → Upload                  │
│   GET    /contracts          → List all                │
│   GET    /contracts/:id      → Get one                 │
│   PATCH  /contracts/:id      → Update                  │
│   DELETE /contracts/:id      → Delete                  │
│                                                         │
│ Analysis:                                               │
│   POST /analyses             → Request AI analysis     │
│   GET  /analyses/:id         → Get result              │
│                                                         │
│ Org:                                                    │
│   POST /orgs                 → Create org              │
│   POST /orgs/:id/invite      → Invite member           │
│                                                         │
│ Headers (all protected routes):                        │
│   Authorization: Bearer {{access_token}}               │
│   Content-Type: application/json                       │
└─────────────────────────────────────────────────────────┘
```

---

**That's it! You're ready to test the LexAI API. Start with the Quick Test Flow above.** 🚀
