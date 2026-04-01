# Design Document: Atlas Migration Config

## Overview

The LexAI backend fails to start because every variable in the root `.env` file is commented
out. Docker Compose reads the host `.env` to perform `${VAR}` substitution into the `api` and
`worker` container environments. When `NODE_ENV=production`, `src/config/env.js` intentionally
skips `dotenv.config()` and reads directly from `process.env` — so if Compose never injects
the vars, `process.env` is empty and the Zod validator exits with code 1 before the app binds
to any port.

The fix is purely configuration: uncomment and populate the `.env` file with the correct Atlas
URI and all other required values. No changes to `db.js`, `redis.js`, or `docker-compose.yml`
are needed.

---

## Architecture

```mermaid
flowchart TD
    A[Host .env file\nuncommented + populated] -->|docker compose up| B[Docker Compose]
    B -->|${VAR} substitution| C[api container\nprocess.env]
    B -->|${VAR} substitution| D[worker container\nprocess.env]
    C --> E[src/config/env.js\nZod validation]
    D --> E
    E -->|valid| F[src/config/db.js\nmongoose.connect]
    E -->|valid| G[src/config/redis.js\nioredis clients]
    F -->|mongodb+srv://| H[MongoDB Atlas]
    G -->|REDIS_HOST=redis| I[Redis container]
    E -->|invalid| J[process.exit 1\nstderr error]
```

The data flow is strictly linear: host `.env` → Compose substitution → container `process.env`
→ Zod validation → service initialization. There is no fallback path; a missing or malformed
variable causes an immediate, loud failure before any request is accepted.

---

## Components and Interfaces

### src/config/env.js (Env_Validator)

No code changes required. Key behaviors to understand:

- Skips `dotenv.config()` when `NODE_ENV=production`
- Validates `MONGO_URI` with `z.string().min(1)` — any non-empty string passes schema validation
- Validates `PASETO_LOCAL_SECRET` with `z.string().min(32)`
- In production, rejects `PASETO_LOCAL_SECRET` containing: `change-me`, `your-key-here`,
  `secret`, `example`, `placeholder`, `Admin112233`, `admin@lexai.io`
- Calls `process.exit(1)` and prints `parsed.error.format()` to stderr on any failure

### src/config/db.js (DB_Module)

No code changes required. Key behaviors:

- Calls `mongoose.connect(uri, { maxPoolSize: 25, minPoolSize: 5, ... })`
- Retries up to 5 times with linear backoff: delay = `3000ms × attempt`
- Calls `process.exit(1)` after 5 failed attempts
- Registers `disconnected` / `reconnected` event listeners for runtime recovery

### src/config/redis.js (Redis_Module)

No code changes required. Key behaviors:

- Creates two ioredis clients: `redisClient` (commands) and `redisSub` (pub/sub)
- Omits `password` from config when `REDIS_PASSWORD` is empty or whitespace-only
- Exposes `isRedisHealthy()` which sends `PING` and checks for `PONG`

### docker-compose.yml (Compose)

No code changes required. Key behaviors:

- `api` and `worker` services use `${VAR}` syntax to pull from host `.env`
- `REDIS_HOST` is hardcoded to `redis` (Docker service name) in both services — overrides
  whatever is in the host `.env`
- `RABBITMQ_URL` is hardcoded to `amqp://guest:guest@rabbitmq:5672` in both services
- Both services have `depends_on: redis: condition: service_healthy` and
  `depends_on: rabbitmq: condition: service_healthy`

---

## Data Models

### .env File Structure

The `.env` file is the sole artifact that requires changes. Below is the complete required
structure with annotations. Values marked `REPLACE` must be filled in by the developer.

```dotenv
# ─── App ───────────────────────────────────────────────────────
NODE_ENV=production
PORT=3100
API_VERSION=v1

# ─── MongoDB Atlas ─────────────────────────────────────────────
# Format: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
# - Use a dedicated Atlas user with readWrite on the target DB only
# - Do NOT include ssl=false or tls=false (Atlas enforces TLS)
# - Do NOT use localhost or 127.0.0.1
MONGO_URI=mongodb+srv://REPLACE_USER:REPLACE_PASSWORD@REPLACE_CLUSTER.mongodb.net/lexai?retryWrites=true&w=majority

# ─── Redis ─────────────────────────────────────────────────────
# REDIS_HOST must be "redis" — the Docker service name
# docker-compose.yml hardcodes REDIS_HOST=redis in the container, but
# setting it here ensures local dev tooling also resolves correctly
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# ─── RabbitMQ ──────────────────────────────────────────────────
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
ANALYSIS_QUEUE=lexai.analysis.queue
ALERT_QUEUE=lexai.alert.queue
DLX_EXCHANGE=lexai.dlx

# ─── PASETO ────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Must be >= 32 chars. Must NOT contain: change-me, secret, example, placeholder
PASETO_LOCAL_SECRET=REPLACE_WITH_64_CHAR_HEX_STRING
PASETO_ACCESS_EXPIRY=15m
PASETO_REFRESH_EXPIRY=7d
PASETO_REFRESH_COOKIE_MAX_AGE_MS=604800000

# ─── OpenRouter AI ─────────────────────────────────────────────
OPENROUTER_API_KEY=REPLACE_WITH_OPENROUTER_KEY
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_PRIMARY_MODEL=meta-llama/llama-3.1-8b-instruct:free
AI_FALLBACK_MODEL=mistralai/mistral-7b-instruct:free

# ─── Rate Limiting ─────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# ─── File Upload ───────────────────────────────────────────────
MAX_FILE_SIZE_MB=5
ALLOWED_MIME_TYPES=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain

# ─── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# ─── Email (Gmail SMTP) ────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=REPLACE_WITH_GMAIL_ADDRESS
SMTP_PASS=REPLACE_WITH_APP_PASSWORD
EMAIL_FROM=noreply@lexai.io

# ─── External APIs ─────────────────────────────────────────────
REST_COUNTRIES_URL=https://restcountries.com/v3.1
WORLD_TIME_API_URL=https://worldtimeapi.org/api

# IPinfo — IP geolocation (optional, 50k req/mo free without token)
IPINFO_TOKEN=

# HaveIBeenPwned — email breach checking (requires paid key, leave empty to disable)
HIBP_API_KEY=

# ─── Admin Bootstrap (seed script only) ────────────────────────
ADMIN_EMAIL=REPLACE_WITH_ADMIN_EMAIL
ADMIN_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# ─── Redis Token TTLs ──────────────────────────────────────────
EMAIL_VERIFICATION_EXPIRY=86400
PASSWORD_RESET_EXPIRY=3600
OTP_EXPIRY=600
```

### Atlas URI Format

```
mongodb+srv://<user>:<password>@<cluster-id>.mongodb.net/<dbname>?retryWrites=true&w=majority
```

| Component | Requirement |
|---|---|
| Scheme | Must be `mongodb+srv://` |
| User | Dedicated Atlas user, not the org owner |
| Password | URL-encoded if it contains special characters |
| Host | Atlas cluster hostname (ends in `.mongodb.net`) |
| Path | Database name (e.g. `/lexai`) — required |
| `retryWrites=true` | Required query param |
| `w=majority` | Required query param |
| `ssl=false` / `tls=false` | Forbidden — Atlas enforces TLS |
| `localhost` / `127.0.0.1` | Forbidden in host segment |

### PASETO_LOCAL_SECRET Generation

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 64-character hex string (32 bytes = 256 bits). Store the output directly as
the value of `PASETO_LOCAL_SECRET`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties serve
as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

### Property 1: Atlas URI format validity

*For any* `MONGO_URI` value in a production `.env` file, it must use the `mongodb+srv://`
scheme, contain `retryWrites=true` and `w=majority` as query parameters, include a non-empty
database name in the path segment, and must not contain `localhost`, `127.0.0.1`, `ssl=false`,
or `tls=false`.

**Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: PASETO secret strength

*For any* `PASETO_LOCAL_SECRET` value accepted by Env_Validator in production, it must be at
least 32 characters long and must not contain any of the substrings: `change-me`,
`your-key-here`, `secret`, `example`, `placeholder`.

**Validates: Requirements 1.2, 8.3**

### Property 3: Env_Validator fails fast on missing required variables

*For any* environment configuration where one or more required variables (`MONGO_URI`,
`PASETO_LOCAL_SECRET`) are absent or empty, Env_Validator must print a descriptive error to
stderr and exit with code 1 before the app accepts any requests.

**Validates: Requirements 1.7, 3.5**

### Property 4: Redis config omits password when empty

*For any* environment where `REDIS_PASSWORD` is an empty string or contains only whitespace,
the ioredis config object built by `buildRedisConfig` must not include a `password` field.

**Validates: Requirements 5.1, 5.2**

### Property 5: DB_Module retry exhaustion exits process

*For any* sequence of 5 consecutive `mongoose.connect` failures, `connectDB` must call
`process.exit(1)` and must not make a 6th connection attempt.

**Validates: Requirements 4.2, 4.3**

### Property 6: Health endpoint includes all service status fields

*For any* call to the `/health` endpoint, the JSON response body must contain a `status` field
(`"ok"` or `"degraded"`), a `services` object with `mongodb`, `redis`, and `rabbitmq` fields,
a `timestamp` ISO string, and an `uptime` integer. The HTTP status must be 200 when all
services are up and 503 when any are down.

**Validates: Requirements 6.1**

### Property 7: .env.example covers all required keys

*For any* required variable key defined in `src/config/env.js` that has no Zod default value,
`.env.example` must contain that key as an uncommented entry.

**Validates: Requirements 8.2**

---

## Error Handling

### Startup Failures

| Failure | Behavior | How to Diagnose |
|---|---|---|
| Any required var missing/empty | Env_Validator prints `parsed.error.format()` to stderr, exits code 1 | `docker compose logs api` |
| `PASETO_LOCAL_SECRET` is placeholder | Env_Validator prints security error, exits code 1 | `docker compose logs api` |
| Atlas unreachable (bad URI, wrong password) | DB_Module retries 5× then exits code 1 | `docker compose logs api \| grep "MongoDB"` |
| Redis container not ready | Compose `depends_on: service_healthy` blocks startup | `docker compose ps` |
| RabbitMQ container not ready | Compose `depends_on: service_healthy` blocks startup | `docker compose ps` |

### Runtime Failures

| Failure | Behavior |
|---|---|
| Atlas disconnects mid-run | Mongoose logs warning, attempts automatic reconnect |
| Redis command error | ioredis retries per `retryStrategy` (exponential backoff, max 5s) |
| Missing `${VAR}` in host `.env` | Compose substitutes empty string → Env_Validator fails on next restart |

### Common Mistakes

- **Leaving `.env` fully commented out**: Compose injects empty strings for all vars →
  Env_Validator exits immediately. Fix: uncomment and populate.
- **Using `mongodb://` instead of `mongodb+srv://`**: Atlas requires SRV. The URI will fail
  DNS resolution. Fix: use the correct scheme.
- **Special characters in Atlas password not URL-encoded**: The URI parser will misread the
  credentials. Fix: URL-encode `@`, `:`, `/`, `?`, `#`, `[`, `]` in the password.
- **Reusing `.env.example` placeholder for `PASETO_LOCAL_SECRET`**: Env_Validator's production
  safety check will reject it. Fix: generate a real secret.

---

## Testing Strategy

This feature is purely configuration — there is no new application code. Testing focuses on
validating the configuration artifacts and the existing validation/connection modules.

### Unit Tests

Target the existing modules to confirm they behave correctly with Atlas-compatible inputs:

- `src/config/env.js`: verify Zod schema rejects missing `MONGO_URI`, rejects
  `PASETO_LOCAL_SECRET` shorter than 32 chars, rejects placeholder secrets in production
- `src/config/redis.js`: verify `buildRedisConfig` omits `password` when `REDIS_PASSWORD` is
  empty or whitespace
- `src/config/db.js`: verify `connectDB` retries exactly 5 times then calls `process.exit(1)`

### Property-Based Tests

Use [fast-check](https://github.com/dubzzz/fast-check) (already compatible with the Jest setup
in this project).

Each property test must run a minimum of 100 iterations. Tag each test with a comment in the
format:

```
// Feature: atlas-migration-config, Property N: <property_text>
```

**Property 1 — Atlas URI format validity**
Generate random strings for user, password, cluster, and dbname components. Assemble valid
Atlas URIs and verify they pass the URI format checks. Also generate invalid URIs (wrong
scheme, localhost host, missing db name) and verify they are rejected.

**Property 2 — PASETO secret strength**
Generate random strings of varying lengths and content. Verify that strings shorter than 32
chars are rejected, and strings containing placeholder substrings are rejected in production
mode. Verify that sufficiently long, clean strings are accepted.

**Property 3 — Env_Validator fails fast**
Generate partial environment objects with one or more required fields removed. Verify that
`safeParse` returns `success: false` for every such input.

**Property 4 — Redis config omits password when empty**
Generate strings that are empty, whitespace-only, or non-empty. Verify that `buildRedisConfig`
only includes `password` in the output when the input is a non-empty, non-whitespace string.

**Property 5 — DB_Module retry exhaustion**
Mock `mongoose.connect` to always throw. Verify that `connectDB` calls `mongoose.connect`
exactly 5 times and then calls `process.exit(1)`.

**Property 6 — Health endpoint response shape**
Generate mock health states (mongo up/down, redis up/down). Verify that the `/health` response
always contains both `mongo` and `redis` fields regardless of their values.

**Property 7 — .env.example key coverage**
Parse the Zod schema to extract all fields with no default. Parse `.env.example` to extract
all uncommented keys. Verify the sets are equal.

### Integration / Smoke Test

After populating `.env` and running `docker compose up -d --build`:

```bash
# 1. Wait for healthy state
docker compose ps

# 2. Confirm Atlas connection
docker compose logs api | grep "MongoDB connected"

# 3. Hit the health endpoint
curl http://localhost:3100/health
# Expected: {"status":"ok","services":{"mongodb":"up","redis":"up","rabbitmq":"up"},...}

# 4. Confirm Redis
docker compose logs api | grep "Redis command client connected"
```

### Secret Hygiene Checks

```bash
# Confirm .env is gitignored
git check-ignore -v .env

# Confirm .env is not staged
git status --short | grep "^A.*\.env"
# Should produce no output
```
