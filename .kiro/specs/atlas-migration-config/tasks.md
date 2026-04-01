# Implementation Plan: Atlas Migration Config

## Overview

All tasks are configuration and test-only. No application source code changes are needed.
The goal is to populate `.env`, verify secret hygiene, write property-based tests for the
correctness properties defined in `design.md`, and confirm the Docker stack reaches a healthy
state.

## Tasks

- [ ] 1. Populate `.env` with all required variables
  - Uncomment every line in `.env` and replace all `REPLACE_*` placeholders with real values
  - Set `NODE_ENV=production`, `PORT=3100`, `REDIS_HOST=redis`, `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672`
  - Set `MONGO_URI` to a valid Atlas SRV URI: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lexai?retryWrites=true&w=majority`
  - Generate `PASETO_LOCAL_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the 64-char hex output
  - Fill in `SMTP_USER`, `SMTP_PASS`, `OPENROUTER_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` with real or intentionally-blank values
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Verify secret hygiene and `.env.example` coverage
  - Confirm `.env` is listed in `.gitignore` (already present — verify with `git check-ignore -v .env`)
  - Confirm `.env` is not staged: `git status --short | grep "^A.*\.env"` should produce no output
  - Add any keys present in `docker-compose.yml` `${VAR}` references but missing from `.env.example` as uncommented placeholder entries
  - Ensure `OTP_EXPIRY` is present in `.env.example` (currently missing)
  - _Requirements: 8.1, 8.2_

- [ ] 3. Write property-based tests for env and Redis config validation
  - Create `tests/unit/config/env-config.property.test.js`
  - Use `@fast-check/jest` (`testProp`) with a minimum of 100 runs per property
  - Tag each test with `// Feature: atlas-migration-config, Property N: <text>`

  - [ ] 3.1 Property 1 — Atlas URI format validity
    - Generate valid Atlas URIs from random user/password/cluster/dbname components and assert they match the required format (scheme, query params, db path, no localhost, no ssl=false)
    - Generate invalid URIs (wrong scheme, localhost host, missing db path) and assert they fail the same checks
    - **Property 1: Atlas URI format validity**
    - **Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 2.5**

  - [ ] 3.2 Property 2 — PASETO secret strength
    - Generate strings of varying length and content; assert that strings shorter than 32 chars are rejected by the Zod schema
    - Assert that strings containing `change-me`, `your-key-here`, `secret`, `example`, or `placeholder` are rejected by the production safety check in `env.js`
    - Assert that strings ≥ 32 chars with none of those substrings are accepted
    - **Property 2: PASETO secret strength**
    - **Validates: Requirements 1.2, 8.3**

  - [ ] 3.3 Property 3 — Env_Validator fails fast on missing required variables
    - Generate partial env objects with `MONGO_URI` and/or `PASETO_LOCAL_SECRET` removed or set to empty string
    - Assert that `envSchema.safeParse(input)` returns `{ success: false }` for every such input
    - Import the Zod schema directly (not the frozen `env` export) to avoid side effects
    - **Property 3: Env_Validator fails fast on missing required variables**
    - **Validates: Requirements 1.7, 3.5**

  - [ ] 3.4 Property 4 — Redis config omits password when empty
    - Generate strings that are empty, whitespace-only (`fc.string({ minLength: 1 })` filtered to `/^\s+$/`), and non-empty non-whitespace
    - Call `buildRedisConfig` (export it or test via the module's internal logic) with each and assert the `password` field is absent for empty/whitespace inputs and present for non-empty inputs
    - **Property 4: Redis config omits password when empty**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 4. Write property-based tests for DB retry and health endpoint shape
  - Create `tests/unit/config/db-health.property.test.js`

  - [ ] 4.1 Property 5 — DB_Module retry exhaustion exits process
    - Mock `mongoose.connect` with `jest.fn()` to always throw a connection error
    - Mock `process.exit` with `jest.fn()` to capture the call without terminating the test process
    - Call `connectDB(uri)` and assert `mongoose.connect` was called exactly 5 times and `process.exit` was called with `1`
    - Use `fc.integer({ min: 1, max: 10 })` to generate random failure counts and assert the cap at 5
    - **Property 5: DB_Module retry exhaustion exits process**
    - **Validates: Requirements 4.2, 4.3**

  - [ ] 4.2 Property 6 — Health endpoint response shape
    - Generate mock health states as booleans for `mongoHealthy`, `redisHealthy`, and `rabbitHealthy`
    - Build the response object the same way the health route does and assert the response always contains `status`, `services.mongodb`, `services.redis`, `services.rabbitmq`, `timestamp`, and `uptime` fields
    - Assert HTTP status is 200 when all three are healthy and 503 when any are down
    - **Property 6: Health endpoint includes all service status fields**
    - **Validates: Requirements 6.1**

- [ ] 5. Write property-based test for `.env.example` key coverage
  - Create `tests/unit/config/env-example.property.test.js`

  - [ ] 5.1 Property 7 — `.env.example` covers all required keys
    - Parse the Zod schema object in `env.js` to extract all field names that have no `.default()` (i.e. `MONGO_URI` and `PASETO_LOCAL_SECRET`)
    - Read `.env.example` with `fs.readFileSync` and extract all uncommented key names
    - Assert that every required key (no default) is present in `.env.example`
    - **Property 7: .env.example covers all required keys**
    - **Validates: Requirements 8.2**

- [ ] 6. Checkpoint — Ensure all property tests pass
  - Run `npm run test:run -- --testPathPattern="tests/unit/config"` and confirm all three test files pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Bring up the Docker stack and verify Atlas connectivity
  - Run `docker compose down` to remove any stale containers
  - Run `docker compose up -d --build` to rebuild and start the stack
  - Run `docker compose ps` and confirm `lexai-api` reaches `healthy` status within 60 seconds
  - Run `docker compose logs api | grep "MongoDB connected"` and confirm the success log line appears
  - Run `curl http://localhost:3100/health` and confirm the JSON response contains `{ "status": "ok", "services": { "mongodb": "up", "redis": "up", "rabbitmq": "up" } }`
  - Run `docker compose logs api | grep "Redis command client connected"` to confirm Redis connectivity
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 8. Final checkpoint — Confirm stack is healthy and secrets are clean
  - Confirm `git status --short | grep "^A.*\.env"` produces no output (`.env` not staged)
  - Confirm `docker compose ps` shows all services as healthy or running
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `buildRedisConfig` in `src/config/redis.js` is not currently exported — task 3.4 may require adding a named export or testing via a thin wrapper; check before implementing
- The Zod schema in `env.js` exports only the frozen `env` object, not the schema itself — task 3.3 will need to import the schema separately or restructure the import; consider exporting `envSchema` alongside `env`
- Property tests use `@fast-check/jest` (`testProp`) which is already installed as a devDependency
- All test files use ESM (`import`/`export`) consistent with the project's `"type": "module"` setting
