# LexAI — AI-Powered Legal Contract Analysis Platform

An Express.js-based backend platform for legal contract analysis with AI-powered enrichment, security hardening, and integrated codebase auditing tools.

## Features

- **Contract Management**: Upload, store, and analyze legal documents (PDF, DOCX, TXT)
- **AI-Powered Enrichment**: Smart contract analysis using multiple AI providers (OpenAI, Groq, OpenRouter)
- **Organization Management**: Multi-tenant support with role-based access control
- **Collaboration**: Comments, tags, bookmarks, and shareable links
- **Real-time Updates**: WebSocket notifications and live status tracking
- **Analytics Dashboard**: Contract statistics and performance metrics
- **Bulk Operations**: Process multiple contracts simultaneously
- **Export Capabilities**: Generate reports in multiple formats (JSON, Markdown, HTML)
- **Template System**: Reusable contract templates
- **Code Quality Auditing**: Built-in CLI tool for analyzing your codebase

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Real-time**: Socket.io
- **Validation**: Joi, Zod, AJV
- **Email**: Nodemailer
- **File Processing**: Multer, Mammoth, PDF-Parse

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or cloud instance)
- Redis (optional, for caching)
- RabbitMQ (optional, for async jobs)

### Installation

```bash
# Clone the repository
npm install

# Copy environment file
cp .env.example .env

# Configure .env with your credentials
```

### Running the Application

```bash
# Start API server
npm start

# Start worker process
npm run start:worker

# Development mode with hot-reload
npm run dev

# Seed database with sample data
npm run seed
```

### Docker Setup

```bash
# Production mode (default)
docker-compose up -d

# Development mode
docker-compose --env-file .env.dev up -d
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `PORT` | API server port |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `RABBITMQ_URL` | RabbitMQ connection string |
| `JWT_SECRET` | Authentication secret |
| `JWT_EXPIRY` | Token expiration time |
| `AI_PROVIDER` | Default AI provider (openai/groq/openrouter) |
| `AI_API_KEY` | AI provider API key |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` — User registration
- `POST /api/v1/auth/verify-email` — Verify email with OTP
- `POST /api/v1/auth/resend-verification-email` — Resend verification email
- `POST /api/v1/auth/login` — User login
- `POST /api/v1/auth/refresh-token` — Refresh access token
- `POST /api/v1/auth/forgot-password` — Request password reset
- `POST /api/v1/auth/reset-password` — Reset password with token
- `POST /api/v1/auth/logout` — Logout
- `POST /api/v1/auth/change-password` — Change password
- `GET /api/v1/auth/sessions` — List active sessions
- `DELETE /api/v1/auth/sessions/:jti` — Revoke session
- `DELETE /api/v1/auth/sessions` — Revoke all sessions

### Users
- `GET /api/v1/users/me` — Current user profile
- `PATCH /api/v1/users/me` — Update profile
- `GET /api/v1/users` — List users (admin)
- `PATCH /api/v1/users/:id` — Update user (admin)

### Organizations
- `POST /api/v1/orgs` — Create organization
- `GET /api/v1/orgs` — List organizations
- `GET /api/v1/orgs/:id` — Get organization
- `PATCH /api/v1/orgs/:id` — Update organization
- `DELETE /api/v1/orgs/:id` — Delete organization

### Contracts
- `POST /api/v1/contracts` — Upload contract
- `GET /api/v1/contracts` — List contracts
- `GET /api/v1/contracts/:id` — Get contract
- `PATCH /api/v1/contracts/:id` — Update contract
- `POST /api/v1/contracts/:id/versions` — Add new version
- `GET /api/v1/contracts/:id/versions` — List versions
- `POST /api/v1/contracts/:id/compare` — Compare versions
- `GET /api/v1/contracts/:id/audit` — Get audit trail
- `DELETE /api/v1/contracts/:id` — Delete contract
- `GET /api/v1/contracts/:id/status` — Get contract status
- `PATCH /api/v1/contracts/:id/status` — Update status
- `GET /api/v1/contracts/:id/status/history` — Status history

### Analysis
- `POST /api/v1/analyses` — Request AI analysis
- `GET /api/v1/analyses/:id` — Get analysis result
- `GET /api/v1/analyses/contract/:id` — Get all analyses for contract
- `DELETE /api/v1/analyses/:id` — Delete analysis

### Templates
- `POST /api/v1/templates` — Create template
- `GET /api/v1/templates` — List templates
- `GET /api/v1/templates/:id` — Get template
- `PATCH /api/v1/templates/:id` — Update template
- `DELETE /api/v1/templates/:id` — Delete template

### Enrichment
- `POST /api/v1/enrichment/clauses` — Extract clauses
- `POST /api/v1/enrichment/risks` — Identify risks
- `POST /api/v1/enrichment/summary` — Generate summary

### AI
- `POST /api/v1/ai/summarize-clause` — Summarize clause
- `POST /api/v1/ai/ask` — Ask question about contract
- `POST /api/v1/ai/extract-terms` — Extract key terms
- `POST /api/v1/ai/chat` — Chat with AI
- `POST /api/v1/ai/complete` — Text completion

### Bookmarks
- `GET /api/v1/bookmarks` — List bookmarks
- `POST /api/v1/bookmarks` — Add bookmark
- `DELETE /api/v1/bookmarks/:id` — Remove bookmark

### Comments
- `POST /api/v1/contracts/:id/comments` — Add comment
- `GET /api/v1/contracts/:id/comments` — List comments
- `PATCH /api/v1/contracts/:id/comments/:id` — Edit comment
- `DELETE /api/v1/contracts/:id/comments/:id` — Delete comment

### Tags
- `GET /api/v1/tags` — List tags
- `POST /api/v1/tags` — Create tag
- `DELETE /api/v1/tags/:id` — Delete tag

### Notifications
- `GET /api/v1/notifications` — List notifications
- `PATCH /api/v1/notifications/:id/read` — Mark as read

### Dashboard
- `GET /api/v1/dashboard/stats` — Get statistics

### Export
- `GET /api/v1/export/contracts` — Export contracts
- `GET /api/v1/export/analysis` — Export analysis

### Bulk Operations
- `POST /api/v1/bulk/upload` — Bulk upload
- `POST /api/v1/bulk/analyze` — Bulk analyze

### Share Links
- `POST /api/v1/share` — Create share link
- `GET /api/v1/share/:token` — Access shared content
- `DELETE /api/v1/share/:id` — Delete share link

### Admin
- `GET /api/v1/admin/users` — Manage users
- `GET /api/v1/admin/stats` — Platform statistics
- `GET /api/v1/admin/audit` — Audit logs

### Health
- `GET /health` — Health check
- `GET /health/ready` — Readiness probe
- `GET /health/live` — Liveness probe

## Codebase Auditor CLI

A built-in CLI tool for static analysis of your codebase:

```bash
# Basic usage
npx codebase-auditor

# With config file
npx codebase-auditor --config ./my-config.json

# Specify directory
npx codebase-auditor --root ./src

# Output formats
npx codebase-auditor --format json,markdown

# Skip checks
npx codebase-auditor --skip todoMarkers,unusedVariables

# Generate Postman collection
npx codebase-auditor --postman-only

# Verbose output
npx codebase-auditor --verbose
```

### Configuration

Create a config file to customize auditing:

```json
{
  "scan": {
    "rootDirectory": ".",
    "includePatterns": ["**/*.js", "**/*.ts"],
    "excludePatterns": ["node_modules/**", "dist/**"]
  },
  "checks": {
    "incompleteFunctions": true,
    "todoMarkers": true,
    "edgeCases": true,
    "logicErrors": true
  },
  "output": {
    "directory": "./audit-results",
    "formats": ["json", "markdown", "html"],
    "generatePostman": true
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

## Authentication

The platform uses **PASETO** (Platform-Agnostic Security Tokens) for authentication.

### Token Types

| Token | Expiry | Purpose |
|-------|-------|---------|
| Access Token | 15 minutes | API requests |
| Refresh Token | 7 days | Token renewal |

### Usage

```bash
# Include in Authorization header
Authorization: Bearer <access_token>

# Refresh token is automatically stored as HttpOnly cookie
```

### Password Requirements

- Minimum 8 characters
- Must contain: uppercase, lowercase, digit, special character
- Special chars allowed: `@$!%*?&.,\-_#^()`

## Security Features

- **Helmet** — Security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Configurable origin filtering
- **Rate Limiting** — 100 requests per minute (configurable)
- **NoSQL Injection Prevention** — mongo-sanitize
- **XSS Prevention** — Input sanitization
- **HPP Prevention** — HTTP Parameter Pollution protection
- **PASETO Tokens** — Secure token authentication
- **bcrypt** — Password hashing

## File Uploads

### Supported Formats

| Type | MIME Type | Max Size |
|------|----------|----------|
| PDF | `application/pdf` | 5 MB |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 5 MB |
| TXT | `text/plain` | 5 MB |

### Endpoints

- `POST /api/v1/contracts` — Upload contract file
- `POST /api/v1/templates` — Upload template file

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Missing or invalid token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## WebSocket Events

### Client Events

| Event | Description |
|-------|-------------|
| `connection` | New client connected |
| `subscribe` | Subscribe to contract updates |

### Server Events

| Event | Description |
|-------|-------------|
| `analysis:progress` | Analysis progress update |
| `analysis:complete` | Analysis finished |
| `notification` | New notification |
| `contract:updated` | Contract updated |

## Additional API Endpoints

### Status
- `GET /api/v1/status` — Get processing status
- `POST /api/v1/status/:id/progress` — Update progress

### Report
- `GET /api/v1/reports` — List reports
- `GET /api/v1/reports/:id` — Get report

### Preference
- `GET /api/v1/preferences` — Get user preferences
- `PATCH /api/v1/preferences` — Update preferences

### Diff
- `POST /api/v1/diff/contracts` — Compare contracts
- `GET /api/v1/diff/:id` — Get diff result

### Invitations
- `POST /api/v1/orgs/:id/invite` — Send invitation
- `POST /api/v1/invitations/:token/accept` — Accept invitation

## Cloud Deployment

### Render Deployment

1. Create a **Web Service** for the API:
   - Build Command: `npm install`
   - Start Command: `node server.js`

2. Create a **Background Worker** for async jobs:
   - Build Command: `npm install`
   - Start Command: `node worker.js`

3. Add environment variables (see `.env.example`)

4. Seed admin user:
   ```bash
   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=SecurePass@123 node scripts/seed.js
   ```

### Required Services

| Service | Free Tier Options |
|--------|-------------------|
| **Hosting** | Render, Railway, VPS |
| **Database** | MongoDB Atlas (M0) |
| **Cache** | Redis Cloud, Upstash |
| **Queue** | CloudAMQP |
| **AI** | Groq, OpenRouter |

### Common Errors

| Error | Fix |
|-------|-----|
| `ECONNREFUSED` | Check service connection strings |
| `CORS blocked` | Add origin to `ALLOWED_ORIGINS` |
| `IP not allowed` | Whitelist IP in MongoDB Atlas |

## Docker Services

| Service | Port | Development Only |
|--------|-----|-----------------|
| API | 3100 | Yes |
| MongoDB | 27017 | Yes |
| Redis | 6379 | Yes |
| RabbitMQ | 5672 | Yes |
| RabbitMQ Management | 15672 | Yes |

## Tests

```bash
# Run all tests
npm test

# Run tests in sequence
npm run test:run

# Run with coverage
npm run test:coverage
```

## License

MIT