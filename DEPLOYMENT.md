# LexAI — Deployment Guide

## Part 1: Push to GitHub

### Step 1 — Create `.gitignore`

Create a `.gitignore` file in the project root:

```
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.production

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Build
dist/
```

### Step 2 — Initialize Git

```bash
cd LexAI
git init
git add .
git commit -m "feat: initial commit — LexAI backend v1.1.0"
```

### Step 3 — Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Set **Repository name** to `LexAI`
3. Set visibility to **Public** or **Private**
4. Do **NOT** init with a README (we already have one)
5. Click **Create repository**

### Step 4 — Connect and Push

```bash
git remote add origin https://github.com/YOUR_USERNAME/LexAI.git
git branch -M main
git push -u origin main
```

### Step 5 — Verify

Visit `https://github.com/YOUR_USERNAME/LexAI` — you should see all files.

---

## Part 2: Deploy on Render

### Prerequisites

You need accounts on:
- [Render](https://render.com) (free tier available)
- [MongoDB Atlas](https://cloud.mongodb.com) (free M0 cluster)
- [Redis Cloud](https://redis.com/try-free/) or [Upstash Redis](https://upstash.com) (free tier)
- [CloudAMQP](https://www.cloudamqp.com) (free Lemur plan for RabbitMQ)

### Step 1 — Set Up External Services

#### MongoDB Atlas (Free M0 Cluster)
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user with a strong password
3. Add `0.0.0.0/0` to the IP whitelist (for Render's dynamic IPs)
4. Copy the connection string: `mongodb+srv://user:password@cluster.mongodb.net/lexai`

#### Redis Cloud / Upstash
1. Create a free Redis instance
2. Copy the host, port, and password

#### CloudAMQP (RabbitMQ)
1. Create a free Lemur instance at [cloudamqp.com](https://www.cloudamqp.com)
2. Copy the AMQP URL: `amqps://user:password@host/vhost`

### Step 2 — Create Render Web Service (API)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account and select the `LexAI` repository
4. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `lexai-api` |
| **Region** | Oregon (US West) or closest to you |
| **Branch** | `main` |
| **Root Directory** | _(leave blank)_ |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | `Free` |

5. Click **Create Web Service**

### Step 3 — Create Render Background Worker

1. Click **New +** → **Background Worker**
2. Connect the same `LexAI` repository
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `lexai-worker` |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `node worker.js` |
| **Plan** | `Free` |

### Step 4 — Add Environment Variables

Go to each service's **Environment** tab and add these variables:

```
# App
NODE_ENV=production
PORT=3000
API_VERSION=v1

# MongoDB Atlas
MONGO_URI=mongodb+srv://lexai_user:YourPassword123@cluster0.abc123.mongodb.net/lexai

# Redis
REDIS_HOST=your-redis-host.redis.cloud
REDIS_PORT=12345
REDIS_PASSWORD=YourRedisPassword123

# RabbitMQ
RABBITMQ_URL=amqps://user:password@rattlesnake.rmq.cloudamqp.com/user
ANALYSIS_QUEUE=lexai.analysis.queue
ALERT_QUEUE=lexai.alert.queue
DLX_EXCHANGE=lexai.dlx

# PASETO (generate a strong random string — at least 32 chars)
# Use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PASETO_LOCAL_SECRET=a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8
PASETO_ACCESS_EXPIRY=15m
PASETO_REFRESH_EXPIRY=7d
PASETO_REFRESH_COOKIE_MAX_AGE_MS=604800000

# AI Provider (Groq — primary)
AI_PROVIDER=groq
AI_PRIMARY_MODEL=llama-3.3-70b-versatile
AI_FALLBACK_MODEL=llama-3.1-8b-instant
AI_DIFF_MODEL=llama-3.1-8b-instant
GROQ_API_KEY=gsk_your-groq-api-key-here
GROQ_BASE_URL=https://api.groq.com/openai/v1
# OpenRouter (optional fallback — leave empty to disable)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# File Upload
MAX_FILE_SIZE_MB=5
ALLOWED_MIME_TYPES=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain

# CORS (add your frontend URL)
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

# Email (use Ethereal for testing, or your SMTP provider)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user
SMTP_PASS=your-ethereal-password
EMAIL_FROM=noreply@lexai.io
```

> **Important:** Both the `lexai-api` and `lexai-worker` services need the **same** environment variables since they share the same codebase and connect to the same databases.

### Step 5 — Deploy

1. Render will auto-deploy when you push to `main`
2. Watch the **Logs** tab for startup messages
3. Wait for `🚀 LexAI API server running on port 3000` to appear

### Step 6 — Seed Admin User

After the first deployment, open the Render **Shell** tab for `lexai-api` and run:

```bash
ADMIN_EMAIL=admin@lexai.io ADMIN_PASSWORD=Admin@Secure123 node scripts/seed.js
```

### Step 7 — Verify Deployment

Your live URL will be:
```
https://lexai-api.onrender.com
```

Test it:
```bash
curl https://lexai-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "services": { "mongodb": "up", "redis": "up", "rabbitmq": "up" },
  "timestamp": "2026-02-22T18:00:00.000Z",
  "uptime": 120
}
```

---

## Common Deployment Errors & Fixes

### 1. "Environment validation failed"
**Cause:** Missing required env vars.
**Fix:** Check all env vars are set in Render dashboard. Especially `MONGO_URI`, `RABBITMQ_URL`, `PASETO_LOCAL_SECRET`, and `GROQ_API_KEY`.

### 2. "MongooseServerSelectionError: connection timed out"
**Cause:** MongoDB Atlas IP whitelist blocking Render's IPs.
**Fix:** Go to Atlas → Network Access → Add `0.0.0.0/0` to allow all IPs (required for free tier).

### 3. "ECONNREFUSED 127.0.0.1:6379"
**Cause:** Redis connecting to localhost instead of cloud Redis.
**Fix:** Ensure `REDIS_HOST` and `REDIS_PORT` are set to your cloud Redis instance, not localhost defaults.

### 4. "AMQP connection refused"
**Cause:** Wrong RabbitMQ URL format.
**Fix:** Use `amqps://` (with 's') for CloudAMQP. Format: `amqps://user:password@host/vhost`

### 5. "Cannot find module '/opt/render/project/src/server.js'"
**Cause:** Start command path issue.
**Fix:** Set start command to `node server.js` (not `node src/server.js` — `server.js` is in root).

### 6. Free tier cold starts (10-30 seconds)
**Cause:** Render free tier spins down after 15 minutes of inactivity.
**Fix:** This is expected behavior. First request after inactivity takes longer. For always-on, upgrade to paid tier ($7/month).

### 7. "CORS blocked"
**Cause:** Frontend URL not in `ALLOWED_ORIGINS`.
**Fix:** Add your deployed frontend URL to `ALLOWED_ORIGINS` env var.

### 8. Worker not processing jobs
**Cause:** `lexai-worker` background worker not running.
**Fix:** Check that both `lexai-api` and `lexai-worker` are deployed and running. They're separate services.

---

## Free Tier Limits

| Service | Free Limit |
|---|---|
| **Render Web Service** | 750 hours/month, spins down after 15min inactivity |
| **Render Background Worker** | 750 hours/month |
| **MongoDB Atlas M0** | 512 MB storage, shared cluster |
| **Redis Cloud** | 30 MB, 1 database |
| **CloudAMQP Lemur** | 1M messages/month, 20 connections |
| **Groq** | 30 req/min, 14,400 req/day (free tier, varies by model) |
