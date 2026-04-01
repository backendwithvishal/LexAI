# Requirements Document

## Introduction

This feature covers migrating the LexAI SaaS backend to use MongoDB Atlas exclusively as its
database, removing any local MongoDB dependency. The root cause of the current startup failure
is that all variables in the `.env` file are commented out, so Docker Compose cannot inject
them into the `api` and `worker` containers. The fix is purely configuration: uncommenting and
populating the `.env` file with the correct Atlas URI and other required values.

The `docker-compose.yml`, `src/config/db.js`, and `src/config/redis.js` are already correct
and require no code changes. When `NODE_ENV=production`, `dotenv` is intentionally skipped and
env vars are read directly from `process.env`, which Docker Compose populates from the host
`.env` file via `${VAR}` substitution.

## Glossary

- **App**: The LexAI Node.js backend process running inside the `api` Docker container
- **Worker**: The LexAI background job process running inside the `worker` Docker container
- **Atlas**: MongoDB Atlas — the cloud-hosted MongoDB service
- **MONGO_URI**: The Atlas connection string in the format `mongodb+srv://...`
- **Env_Validator**: The Zod-based validation module at `src/config/env.js`
- **DB_Module**: The Mongoose connection module at `src/config/db.js`
- **Redis_Module**: The ioredis connection module at `src/config/redis.js`
- **Compose**: Docker Compose, which reads the host `.env` file and injects vars into containers
- **Health_Endpoint**: The `/health` HTTP endpoint exposed by the App
- **PASETO_LOCAL_SECRET**: A cryptographic secret of at least 32 characters used for token signing

---

## Requirements

### Requirement 1: Populate the .env File

**User Story:** As a developer, I want all required environment variables uncommented and filled
in the `.env` file, so that Docker Compose can inject them into the running containers and the
app starts successfully.

#### Acceptance Criteria

1. THE `.env` file SHALL contain `MONGO_URI` as an uncommented key with a value matching the
   pattern `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`
2. THE `.env` file SHALL contain `PASETO_LOCAL_SECRET` as an uncommented key with a value of
   at least 32 characters
3. THE `.env` file SHALL contain `NODE_ENV=production` as an uncommented key when running in
   Docker
4. THE `.env` file SHALL contain `PORT=3100` as an uncommented key matching the port exposed
   in `docker-compose.yml`
5. THE `.env` file SHALL contain `REDIS_HOST=redis` as an uncommented key so the App resolves
   the Redis container by its Docker service name
6. THE `.env` file SHALL contain `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672` as an
   uncommented key so the App resolves RabbitMQ by its Docker service name
7. IF any required variable listed in `src/config/env.js` is missing or empty, THEN THE
   Env_Validator SHALL print a descriptive error to stderr and exit with code 1 before the App
   accepts any requests

---

### Requirement 2: Atlas Connection String Format

**User Story:** As a developer, I want to know the exact format of a valid Atlas MONGO_URI, so
that I can populate the `.env` file correctly and avoid connection failures.

#### Acceptance Criteria

1. THE MONGO_URI SHALL use the `mongodb+srv://` scheme when connecting to Atlas
2. THE MONGO_URI SHALL include `retryWrites=true&w=majority` as query parameters
3. THE MONGO_URI SHALL include the target database name in the path segment (e.g. `/lexai`)
4. IF the Atlas cluster requires TLS, THEN THE MONGO_URI SHALL NOT include `ssl=false` or
   `tls=false` parameters, as Atlas enforces TLS by default
5. THE MONGO_URI SHALL NOT use `localhost` or `127.0.0.1` as the host when targeting Atlas

---

### Requirement 3: Docker Compose Environment Variable Injection

**User Story:** As a developer, I want Docker Compose to correctly pass all env vars from the
host `.env` file into the `api` and `worker` containers, so that the App reads them from
`process.env` without needing dotenv at runtime.

#### Acceptance Criteria

1. WHEN `NODE_ENV=production`, THE App SHALL read all configuration from `process.env` directly
   without loading the `.env` file via dotenv
2. THE Compose `api` service SHALL receive `MONGO_URI` from the host `.env` via `${MONGO_URI}`
   substitution
3. THE Compose `worker` service SHALL receive `MONGO_URI` from the host `.env` via
   `${MONGO_URI}` substitution
4. THE Compose `api` service SHALL override `REDIS_HOST` to the value `redis` (the Docker
   service name) regardless of what is set in the host `.env`
5. IF a `${VAR}` reference in `docker-compose.yml` has no corresponding value in the host
   `.env`, THEN Compose SHALL substitute an empty string, which will cause Env_Validator to
   fail fast on startup

---

### Requirement 4: Mongoose Atlas Compatibility

**User Story:** As a developer, I want to confirm the existing Mongoose connection code works
with Atlas without modification, so that I don't make unnecessary code changes.

#### Acceptance Criteria

1. THE DB_Module SHALL connect to Atlas using the `MONGO_URI` value from `process.env` with no
   code changes required
2. WHEN the initial connection attempt fails, THE DB_Module SHALL retry up to 5 times using
   linear backoff starting at 3 seconds
3. WHEN all 5 retry attempts are exhausted, THE DB_Module SHALL exit the process with code 1
4. WHEN the connection is established, THE DB_Module SHALL maintain a pool of between 5 and 25
   concurrent connections
5. WHEN a runtime disconnection occurs after initial connect, THE DB_Module SHALL log a warning
   and allow Mongoose's built-in reconnect logic to recover the connection automatically

---

### Requirement 5: Redis Connectivity

**User Story:** As a developer, I want Redis to remain fully functional after the Atlas
migration, so that caching, rate limiting, and pub/sub features continue to work.

#### Acceptance Criteria

1. THE Redis_Module SHALL initialize both the command client and the subscriber client using
   `REDIS_HOST=redis` and `REDIS_PORT=6379` from the injected environment
2. WHEN `REDIS_PASSWORD` is an empty string or whitespace, THE Redis_Module SHALL connect
   without sending a password to avoid the "password not required" warning
3. WHEN the Health_Endpoint is called, THE App SHALL report Redis status as healthy if the
   command client responds to a `PING` command with `PONG`
4. IF the Redis container is not yet ready, THEN Compose SHALL hold the `api` and `worker`
   services until the Redis healthcheck passes before starting them

---

### Requirement 6: Startup Verification

**User Story:** As a developer, I want a clear way to verify that the Atlas connection and all
services are working after bringing Docker Compose up, so that I can confirm the migration
succeeded.

#### Acceptance Criteria

1. WHEN the App starts successfully, THE Health_Endpoint SHALL return HTTP 200 with a JSON body
   containing `status: "ok"`, a `services` object with `mongodb`, `redis`, and `rabbitmq`
   fields, a `timestamp` ISO string, and an `uptime` integer in seconds
2. WHEN `docker compose up -d` is run after populating the `.env` file, THE App container SHALL
   reach a healthy state within 60 seconds as determined by the Compose healthcheck
3. THE developer SHALL be able to verify Atlas connectivity by running
   `docker compose logs api | grep "MongoDB connected"` and observing the success log line
4. IF the App container enters an unhealthy or restarting state, THEN the developer SHALL
   inspect logs via `docker compose logs api` to identify which env var failed Env_Validator

---

### Requirement 7: Restart and Cleanup Procedure

**User Story:** As a developer, I want to know the exact Docker commands to bring the stack
down, clean up stale state, and restart cleanly, so that I can apply `.env` changes without
leftover container state causing confusion.

#### Acceptance Criteria

1. THE developer SHALL stop and remove all containers by running `docker compose down`
2. WHERE stale volume data may cause issues, THE developer SHALL remove named volumes by
   running `docker compose down -v`
3. WHEN the `.env` file has been updated, THE developer SHALL rebuild and restart the stack
   with `docker compose up -d --build`
4. THE developer SHALL NOT need to remove the `redis_data` or `rabbitmq_data` volumes unless
   explicitly troubleshooting data corruption, as Atlas migration does not affect those volumes

---

### Requirement 8: Security and Secret Hygiene

**User Story:** As a developer, I want to ensure secrets in the `.env` file are handled safely,
so that credentials are not accidentally committed to version control or exposed.

#### Acceptance Criteria

1. THE `.env` file SHALL be listed in `.gitignore` so it is never committed to the repository
2. THE `.env.example` file SHALL contain all variable keys with placeholder values and SHALL be
   committed to the repository as a reference template
3. WHEN `NODE_ENV=production`, THE Env_Validator SHALL reject any `PASETO_LOCAL_SECRET` value
   that contains the substrings `change-me`, `secret`, `example`, or `placeholder`
4. THE Atlas connection string stored in `MONGO_URI` SHALL use a dedicated Atlas database user
   with the minimum required permissions (readWrite on the target database only)
5. THE Atlas database user password SHALL NOT be reused for any other service or account
