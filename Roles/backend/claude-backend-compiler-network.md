# Backend Developer Role Decomposition
## Domain Compiler Network — Formal Task Type Specification

> **Stack:** Node.js · TypeScript · Express/Fastify/Hapi · PostgreSQL · Prisma/Drizzle · Redis · BullMQ · REST + GraphQL · Jest/Vitest
>
> **Already built (excluded):** `ts-schema`, `api-route`, `auth-middleware`, `db-migration`, `openapi-spec`
>
> **Shared/cross-role (excluded):** `utility-fn`, `analytics-event`, `feature-flag`, `i18n`

---

## Summary Table — All 22 Task Types

| # | Compiler Name | Frequency | Input | Output |
|---|---|---|---|---|
| 01 | `env-config` | Per-project / per-env-change | Env var list + type + secret classification | Zod env schema, typed `config.ts`, `.env.example` |
| 02 | `db-seed` | Per-project / per-model-add | Prisma/Drizzle schema + fixture spec | `seed.ts`, factory fns, deterministic fixtures |
| 03 | `service-client` | Per-external-service | API docs / OpenAPI spec of target service | Typed client class, retry/timeout config, mock |
| 04 | `repository` | Per-domain-model | DB schema + query spec | Repository class `.ts`, query methods, unit tests |
| 05 | `cache-layer` | Per-feature / per-query | Query spec + TTL policy + invalidation rules | Redis wrapper, typed get/set/invalidate, tests |
| 06 | `background-job` | Per-job-type | Job payload spec + schedule/trigger + retry policy | BullMQ worker `.ts`, job definition, processor, tests |
| 07 | `job-scheduler` | Per-project / per-cron-add | Cron schedule spec + job references | Scheduler bootstrap, cron definitions, health probe |
| 08 | `event-publisher` | Per-event-type | Event schema + broker config (Redis/SQS/Kafka) | Publisher class, typed event envelope, tests |
| 09 | `event-consumer` | Per-event-type | Event schema + consumer group + handler spec | Consumer class, handler, DLQ config, tests |
| 10 | `webhook-handler` | Per-webhook-source | Webhook payload schema + signature spec | Route handler, signature verifier, idempotency guard, tests |
| 11 | `webhook-emitter` | Per-webhook-destination | Outbound event spec + retry policy + signing key | Emitter service, HMAC signer, delivery log model, tests |
| 12 | `rate-limiter` | Per-endpoint-group | Rate limit policy (window, max, key strategy) | Rate-limit middleware, Redis sliding-window impl, tests |
| 13 | `pagination` | Per-query / per-collection | Collection query spec + cursor or offset strategy | Paginated query fn, response envelope type, tests |
| 14 | `file-upload` | Per-feature | File type/size spec + storage backend (S3/local) | Multipart handler, storage adapter, virus-scan hook, tests |
| 15 | `health-check` | Per-project / per-dependency-add | Dependency list (DB, Redis, queues, services) | `/health` + `/ready` endpoints, structured response, tests |
| 16 | `graphql-schema` | Per-domain-model / per-feature | Domain types + resolver spec + auth rules | SDL `.graphql`, resolver map `.ts`, type-safe context |
| 17 | `graphql-resolver` | Per-type / per-field-group | GraphQL schema + data sources + N+1 spec | Resolver `.ts`, DataLoader setup, auth directives, tests |
| 18 | `data-transformer` | Per-integration / per-pipeline | Input schema + output schema + mapping rules | Transform fn `.ts`, bidirectional mappers, tests |
| 19 | `error-catalog` | Per-project / per-domain-add | Error taxonomy (code, message, HTTP status, retryable) | Error class hierarchy `.ts`, error factory, typed codes |
| 20 | `logger` | Per-project | Log level policy + structured fields spec + sink config | Logger singleton, request-context middleware, redaction rules |
| 21 | `integration-test-suite` | Per-feature / per-service | API contract + seed data + environment spec | Supertest/Vitest suite `.ts`, DB setup/teardown, fixtures |
| 22 | `db-query-optimizer` | Per-slow-query / per-release | Query execution plans + index spec + perf baseline | Indexed migrations, query rewrites, EXPLAIN analysis report |

---

## Detailed Task Breakdowns

---

### 01 · `env-config` — Per-project / per-env-change

**Name:** Environment & Configuration Compiler

| Field | Detail |
|---|---|
| **Input** | Exhaustive list of environment variables (name, type, required/optional, secret vs. public, per-environment values), runtime config shape (feature toggles, service URLs, timeouts), deployment environment matrix (local / staging / prod). |
| **Output** | `src/config/env.schema.ts` (Zod schema for all env vars), `src/config/config.ts` (typed config object, parsed at startup), `.env.example` (all keys documented, no values), `src/config/config.test.ts` (validates schema against all env matrices). |
| **Correctness gates** | (1) `process.env` is never accessed outside `config.ts` — enforced by ESLint `no-process-env` rule with zero violations. (2) Missing required var throws `ZodError` at process start — verified by test that unsets each required var and asserts process exits non-zero. (3) Secret vars are never assigned to `NEXT_PUBLIC_` / client-exposed prefixes. (4) `.env.example` contains every key present in Zod schema — diffed by a CI script. (5) TypeScript strict mode: config object has no `any` or `string \| undefined` without a default. |
| **Dependencies** | None. This is the zero-dependency primitive for all runtime config. |
| **Downstream consumers** | `service-client` (base URLs), `cache-layer` (Redis URL/TTL defaults), `background-job` (queue connection), `event-publisher`, `event-consumer`, `logger` (log level, sink), `health-check`, every compiler that touches a connection string or secret. |

---

### 02 · `db-seed` — Per-project / per-model-add

**Name:** Database Seed & Fixture Compiler

| Field | Detail |
|---|---|
| **Input** | Prisma or Drizzle schema (must exist), fixture spec (entity counts, relationship graph, edge-case rows: nulls, max-length strings, boundary dates, soft-deleted records), environment target (development / test / staging). |
| **Output** | `prisma/seed.ts` or `src/db/seed.ts` (idempotent seed entrypoint), `src/test/factories/modelName.factory.ts` (one per model, using `@faker-js/faker` with `faker.seed()`), `src/test/fixtures/*.ts` (static deterministic fixtures for unit tests). |
| **Correctness gates** | (1) Seed script is idempotent — running it twice produces identical row counts (verified by running 2× in CI and asserting `SELECT COUNT(*)` per table). (2) All factory outputs pass Zod schema validation of the corresponding `ts-schema` type. (3) Foreign key relationships are satisfied — no seed run produces FK constraint violations. (4) Seed does not run against `NODE_ENV=production` — guarded by an env check that throws. (5) Factory `faker.seed(n)` produces byte-for-byte identical output across Node versions (tested in CI matrix). |
| **Dependencies** | `ts-schema` (for Zod validation of factory output), `db-migration` (schema must be applied before seed runs). |
| **Downstream consumers** | `repository` (integration tests use factories), `integration-test-suite` (DB setup/teardown uses seed), `graphql-resolver` (test harness uses factories). |

---

### 03 · `service-client` — Per-external-service

**Name:** External Service Client Compiler

| Field | Detail |
|---|---|
| **Input** | OpenAPI 3.x spec (or equivalent Postman/proto/prose spec) of the target external service, authentication scheme (Bearer, API key, OAuth2 client credentials), retry policy (max attempts, backoff strategy, retryable HTTP codes), timeout budget (connect, read, total), circuit-breaker requirements. |
| **Output** | `src/clients/ServiceNameClient.ts` (typed class wrapping `axios` or `undici`), `src/clients/ServiceNameClient.mock.ts` (jest/vitest manual mock with same interface), `src/clients/ServiceNameClient.test.ts` (unit tests with mocked HTTP), `src/clients/types.ts` (request/response types derived from spec). |
| **Correctness gates** | (1) Every public method has a return type matching a `ts-schema`-validated Zod type — no `any` return. (2) Retry logic is tested: mock returns 429/503 N-1 times then 200 — test asserts exactly N HTTP calls made. (3) Timeout throws within `timeout + 50ms` — verified with a jest fake timer test. (4) Mock implements the same TypeScript interface as the real client — enforced by `implements IServiceNameClient`. (5) Circuit breaker opens after threshold failures and returns fallback without HTTP calls — asserted in test. (6) All secrets (API keys) sourced from `env-config`, never hardcoded — verified by `grep` CI gate. |
| **Dependencies** | `ts-schema` (response types), `env-config` (base URL, credentials, timeouts). |
| **Downstream consumers** | `api-route` (calls service client), `background-job` (outbound calls in workers), `integration-test-suite` (mock injected). |

---

### 04 · `repository` — Per-domain-model

**Name:** Data Repository Compiler

| Field | Detail |
|---|---|
| **Input** | DB schema (Prisma model or Drizzle table definition), query spec (list of named operations: findById, findManyByFilter, create, update, upsert, softDelete, count), filter/sort/pagination requirements per operation, transaction participation spec. |
| **Output** | `src/repositories/ModelNameRepository.ts` (class with all specified query methods), `src/repositories/IModelNameRepository.ts` (interface, for DI/mocking), `src/repositories/ModelNameRepository.test.ts` (unit tests with Prisma mock or in-memory Drizzle), `src/repositories/index.ts` (barrel export). |
| **Correctness gates** | (1) All methods return types derived from `ts-schema` Zod types — no raw Prisma/Drizzle types leaked to callers. (2) Soft-delete queries always include `WHERE deleted_at IS NULL` — verified by asserting generated SQL via Prisma query log in tests. (3) Every method is covered by at minimum a happy-path and a not-found/empty test. (4) No raw SQL strings unless explicitly in spec — ESLint rule bans `$queryRawUnsafe`. (5) All write operations (create/update/delete) emit a unit-testable side-effect hook for `event-publisher` (even if no-op by default). (6) Transactions roll back on any thrown error — tested by injecting an error mid-transaction and asserting DB state unchanged. |
| **Dependencies** | `ts-schema` (entity types), `db-migration` (table must exist), `db-seed` (test fixtures for repository tests). |
| **Downstream consumers** | `api-route`, `graphql-resolver`, `background-job`, `integration-test-suite`. |

---

### 05 · `cache-layer` — Per-feature / per-query

**Name:** Redis Cache Layer Compiler

| Field | Detail |
|---|---|
| **Input** | Query or computation spec (what data is cached), cache key schema (key pattern with typed params), TTL policy (default TTL, per-variant TTLs), invalidation rules (which write operations must bust which keys), serialisation format (JSON / MessagePack), stampede-prevention requirement (probabilistic early expiry or lock). |
| **Output** | `src/cache/modelNameCache.ts` (typed get/set/delete/invalidate functions), `src/cache/keys.ts` (centralised key-builder functions), `src/cache/cache.test.ts` (unit tests with `ioredis-mock`), optional `src/cache/cacheWarmer.ts` (background warm-up job). |
| **Correctness gates** | (1) Cache miss always falls through to the data source and populates cache — tested by asserting Redis `SET` called after a cold get. (2) TTL is set on every `SET` — verified by asserting `EX` argument present in all `SET` calls in tests. (3) Invalidation test: perform write operation → assert corresponding cache keys are deleted (not stale). (4) No cache key collision: key-builder functions for different entities produce disjoint key spaces — verified by snapshot test of all key outputs. (5) Type safety: `get` return type matches the Zod schema for the cached entity — no `any`. (6) Stampede guard present if specified: concurrent cold misses result in exactly one DB query (tested with concurrent Promises). |
| **Dependencies** | `env-config` (Redis URL, default TTL), `ts-schema` (cached entity types), `repository` (cache wraps repository calls). |
| **Downstream consumers** | `api-route` (injects cache layer), `graphql-resolver`, `background-job` (cache warming). |

---

### 06 · `background-job` — Per-job-type

**Name:** Background Job Worker Compiler

| Field | Detail |
|---|---|
| **Input** | Job payload schema (Zod), trigger type (queue-enqueued / scheduled / event-driven), processing logic spec (steps, external calls, DB writes), retry policy (max attempts, backoff: fixed/exponential, jitter), failure behaviour (DLQ, alert, compensating transaction), idempotency requirement (is re-processing safe?). |
| **Output** | `src/jobs/jobName.job.ts` (BullMQ `Worker` definition with processor), `src/jobs/jobName.types.ts` (payload type + result type), `src/jobs/jobName.enqueue.ts` (typed enqueue helper), `src/jobs/jobName.test.ts` (unit tests with mocked dependencies), optional `src/jobs/jobName.compensate.ts` (rollback handler). |
| **Correctness gates** | (1) Payload validated with Zod at job entry — malformed payload throws `ZodError` and job moves to failed without retry. (2) Idempotent jobs: processing same payload twice produces same DB state — tested by running processor twice and asserting `SELECT` result identical. (3) Retry exhaustion routes job to DLQ — tested by mocking processor to always throw and asserting BullMQ `failed` event. (4) Job processor never calls `process.exit` — ESLint rule. (5) All external I/O (DB, HTTP, Redis) injected as dependencies — no module-level singletons, enabling unit testing without live infrastructure. (6) Graceful shutdown: in-flight job completes before worker closes (tested with `worker.close()` mid-processing). |
| **Dependencies** | `ts-schema` (payload types), `env-config` (queue connection), `repository` (DB writes in processor), optionally `service-client` (outbound HTTP in processor). |
| **Downstream consumers** | `job-scheduler` (schedules this job), `event-consumer` (may enqueue jobs), `integration-test-suite`. |

---

### 07 · `job-scheduler` — Per-project / per-cron-add

**Name:** Cron Job Scheduler Compiler

| Field | Detail |
|---|---|
| **Input** | Schedule spec (cron expression per job, timezone, overlap policy: skip / queue / kill-previous), list of `background-job` references, distributed-lock requirement (prevent multi-instance double-fire). |
| **Output** | `src/scheduler/scheduler.ts` (bootstrap module registering all cron jobs via BullMQ `repeatableJob` or `node-cron`), `src/scheduler/schedules.config.ts` (typed schedule definitions), `src/scheduler/scheduler.test.ts` (validates cron expressions, asserts jobs registered), health probe addition to `health-check`. |
| **Correctness gates** | (1) All cron expressions are valid — validated by `cron-parser` at startup, throws on invalid expression. (2) No two jobs share identical `{ name, cron }` tuple — uniqueness checked at registration. (3) Distributed lock test: simulate two scheduler instances starting simultaneously — assert job enqueued exactly once. (4) Timezone correctness: scheduled job fires within ±5s of expected UTC time in CI time-travel test. (5) Graceful shutdown: scheduler drains without orphaning repeatable job entries in Redis. |
| **Dependencies** | `background-job` (jobs must exist before scheduling), `env-config` (Redis queue connection), `health-check` (registers its own health probe). |
| **Downstream consumers** | `health-check` (scheduler liveness probe), `integration-test-suite`. |

---

### 08 · `event-publisher` — Per-event-type

**Name:** Domain Event Publisher Compiler

| Field | Detail |
|---|---|
| **Input** | Event schema (name, version, payload Zod schema), broker target (Redis Streams / BullMQ / SQS / Kafka topic), ordering guarantee requirement, at-least-once vs. exactly-once delivery spec, event envelope spec (id, timestamp, version, source service, correlation-id). |
| **Output** | `src/events/publishers/eventName.publisher.ts` (typed publish function), `src/events/envelope.ts` (shared event envelope type + builder), `src/events/eventName.types.ts` (payload type), `src/events/publishers/eventName.publisher.test.ts`. |
| **Correctness gates** | (1) Payload validated against Zod schema before publish — publishing malformed payload throws, never silently drops. (2) Event envelope includes `id` (UUID v4), `timestamp` (ISO 8601), `version`, `source`, `correlationId` — all fields asserted present in tests. (3) Publish is transactionally safe if spec requires: tested by asserting no event emitted when surrounding DB transaction rolls back (outbox pattern or BullMQ `sandwichTransaction`). (4) No `any` in published payload type. (5) Publisher is mockable: implements `IEventPublisher<T>` interface. |
| **Dependencies** | `ts-schema` (payload types), `env-config` (broker connection, topic names). |
| **Downstream consumers** | `repository` (publishes after writes), `background-job` (publishes job results), `event-consumer` (on same broker), `integration-test-suite`. |

---

### 09 · `event-consumer` — Per-event-type

**Name:** Domain Event Consumer Compiler

| Field | Detail |
|---|---|
| **Input** | Event schema (must match publisher), consumer group name, handler spec (what to do with each event), DLQ policy (max retries before DLQ, alert on DLQ ingress), idempotency requirement (event ID deduplication window). |
| **Output** | `src/events/consumers/eventName.consumer.ts` (consumer class with message loop), `src/events/consumers/eventName.handler.ts` (business logic, separately testable), `src/events/consumers/eventName.consumer.test.ts`, DLQ configuration entry. |
| **Correctness gates** | (1) Consumer validates incoming payload with Zod — invalid message goes to DLQ, not crashes process. (2) Idempotency: processing same event ID twice produces no side-effect on second run — tested with duplicate-event injection. (3) Handler failures retry up to configured max — tested by mocking handler to throw N times and asserting retry count. (4) DLQ routing after exhaustion — tested by asserting message lands in DLQ topic after max retries. (5) Consumer commits offset/ack only after successful handler completion — not before. (6) Graceful shutdown: consumer finishes in-flight message before closing. |
| **Dependencies** | `event-publisher` (shared envelope type), `ts-schema` (payload validation), `env-config` (broker config), `repository` (handler writes to DB). |
| **Downstream consumers** | `background-job` (consumer may enqueue jobs), `integration-test-suite`. |

---

### 10 · `webhook-handler` — Per-webhook-source

**Name:** Inbound Webhook Handler Compiler

| Field | Detail |
|---|---|
| **Input** | Webhook payload schema (provider-specific, e.g. Stripe, GitHub, Twilio), signature verification spec (HMAC-SHA256 header name + secret, or RSA public key), idempotency key field (e.g. `event.id`), list of event types to handle vs. ignore, retry/replay policy from provider. |
| **Output** | `src/webhooks/providerName.handler.ts` (Express/Fastify route handler), `src/webhooks/providerName.verifier.ts` (signature verification function), `src/webhooks/providerName.types.ts` (payload union type per event type), `src/webhooks/providerName.handler.test.ts`. |
| **Correctness gates** | (1) Signature verification runs before payload parsing — request with invalid signature returns 401 with no further processing. (2) Raw body used for signature verification (not parsed JSON) — tested by asserting verifier receives `Buffer`, not object. (3) Idempotency: duplicate `event.id` returns 200 without re-processing — tested by sending same event twice and asserting handler called once. (4) Unknown event types return 200 (acknowledge) but no handler invoked — not 400. (5) Payload validated with Zod per event type — malformed payload logs error and returns 200 (do not return 4xx to webhook provider). (6) Handler is enqueue-only: never performs long synchronous work inline — asserts background job enqueued within 100ms. |
| **Dependencies** | `ts-schema` (payload types), `api-route` (registers the HTTP route), `background-job` (enqueues processing), `env-config` (signing secret). |
| **Downstream consumers** | `background-job` (processes webhook events), `integration-test-suite`. |

---

### 11 · `webhook-emitter` — Per-webhook-destination

**Name:** Outbound Webhook Emitter Compiler

| Field | Detail |
|---|---|
| **Input** | Outbound event spec (which internal events trigger webhooks), payload transform spec (internal event → webhook payload), HMAC signing key strategy (per-endpoint secrets stored in DB), retry policy (max attempts, exponential backoff, timeout), delivery log retention spec. |
| **Output** | `src/webhooks/emitter/webhookEmitter.ts` (delivery service: sign, send, log), `src/webhooks/emitter/webhookDelivery.model.ts` (Prisma/Drizzle model for delivery log), `src/webhooks/emitter/webhookEmitter.test.ts`, DB migration entry for delivery log table. |
| **Correctness gates** | (1) HMAC signature computed over exact serialised payload body — verified by recipient re-computing and comparing. (2) Delivery attempt logged before HTTP send (at-least-once log) — tested by killing HTTP call mid-flight and asserting log entry exists. (3) Failed deliveries retried with exponential backoff up to max attempts — tested with mock server returning 500. (4) Endpoint URL validated as HTTPS only — HTTP target throws at registration, never sends. (5) Dead endpoints (all retries exhausted) flagged in DB with `status = 'failed'` — not silently dropped. (6) Delivery log includes `request_headers`, `response_status`, `response_body`, `duration_ms`. |
| **Dependencies** | `ts-schema` (payload types), `event-publisher`/`event-consumer` (triggers), `env-config` (signing key rotation config), `background-job` (retries run as jobs), `db-migration` (delivery log table). |
| **Downstream consumers** | `integration-test-suite`, `health-check` (unhealthy endpoints surface in health). |

---

### 12 · `rate-limiter` — Per-endpoint-group

**Name:** Rate Limit Middleware Compiler

| Field | Detail |
|---|---|
| **Input** | Rate limit policy spec (window duration, max requests, key strategy: IP / user ID / API key / composite), response spec (headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`), burst allowance, penalty box spec (escalating limits after repeated violations), bypass list (internal service IPs). |
| **Output** | `src/middleware/rateLimit/rateLimiter.ts` (sliding-window Redis implementation using `ioredis`), `src/middleware/rateLimit/rateLimiter.config.ts` (typed policy definitions), `src/middleware/rateLimit/rateLimiter.test.ts` (unit + integration tests with Redis mock). |
| **Correctness gates** | (1) Sliding window: 101st request within window returns 429 — tested by firing 101 sequential requests in a loop. (2) Window resets correctly: after window expires, counter resets to 0 — time-travel tested with fake timers. (3) All three `X-RateLimit-*` headers present on every response (both 200 and 429). (4) Bypass list IPs never rate-limited — tested explicitly. (5) Redis key expires at window end (no leaked keys) — asserted via `TTL` command after requests. (6) Atomic increment: concurrent requests cannot both see count = 0 (Lua script or `INCR`+`EXPIRE`) — tested with `Promise.all(100 concurrent requests)`. |
| **Dependencies** | `env-config` (Redis URL, default window/limit), `auth-middleware` (user ID available on request for user-keyed limits). |
| **Downstream consumers** | `api-route` (applies middleware), `integration-test-suite`. |

---

### 13 · `pagination` — Per-query / per-collection

**Name:** Pagination Compiler

| Field | Detail |
|---|---|
| **Input** | Collection query spec (entity, sortable fields, default sort, max page size), pagination strategy (cursor-based with opaque cursor vs. offset/limit), response envelope spec (`data`, `meta.total`, `meta.nextCursor` / `meta.page`, `meta.hasNextPage`). |
| **Output** | `src/pagination/paginate.ts` (generic pagination wrapper function), `src/pagination/cursor.ts` (cursor encode/decode: base64 over `{field, value, id}`), `src/pagination/pagination.types.ts` (typed `PaginatedResult<T>`, `CursorPaginationParams`, `OffsetPaginationParams`), `src/pagination/paginate.test.ts`. |
| **Correctness gates** | (1) Cursor is opaque (base64-encoded) — raw field values never appear in API response. (2) Decoding a tampered cursor returns a validation error, not a DB query with arbitrary values — fuzz tested with 100 random strings. (3) Paginating all pages retrieves every row exactly once and no row twice — tested by seeding N rows and asserting `Set(all returned IDs).size === N`. (4) `hasNextPage` is accurate: last page returns `false`, non-last returns `true` — tested at boundary. (5) Max page size enforced: requesting > max returns max rows, no error — prevents DDOS via `limit=999999`. (6) Empty collection returns `data: []`, `hasNextPage: false`, no crash. |
| **Dependencies** | `ts-schema` (entity types), `repository` (pagination wraps repository queries). |
| **Downstream consumers** | `api-route`, `graphql-resolver`, `integration-test-suite`. |

---

### 14 · `file-upload` — Per-feature

**Name:** File Upload Handler Compiler

| Field | Detail |
|---|---|
| **Input** | File type allowlist (MIME types), size limits (per-file, per-request), storage backend spec (S3-compatible / local disk / GCS), virus scan requirement (ClamAV / cloud API), filename strategy (UUID rename / content-hash), access control spec (public URL vs. signed URL with TTL), metadata storage spec (which fields to persist in DB). |
| **Output** | `src/uploads/uploadHandler.ts` (multipart middleware + route handler), `src/uploads/storageAdapter.ts` (interface + S3/local implementations), `src/uploads/uploadHandler.test.ts` (unit tests with mock storage), `src/uploads/upload.types.ts`. |
| **Correctness gates** | (1) File type validated by reading magic bytes (file signature), not just MIME header or extension — tested by sending `.exe` with `Content-Type: image/png`. (2) Size limit enforced before full read — connection closed at limit, not after full upload buffered in memory. (3) Stored filename is always UUID-derived, never the original client filename — asserted in tests (path traversal prevention). (4) Virus scan called before URL returned to client — mock scan returning "infected" causes 422 and storage deletion. (5) Signed URLs expire within specified TTL — asserted by checking URL expiry param. (6) Failed upload performs storage cleanup — no orphaned files on S3 after handler error. |
| **Dependencies** | `env-config` (storage credentials, bucket name, scan API key), `auth-middleware` (upload requires auth), `ts-schema` (upload metadata types), `db-migration` (file metadata table). |
| **Downstream consumers** | `api-route` (mounts upload route), `background-job` (async post-processing of uploads), `integration-test-suite`. |

---

### 15 · `health-check` — Per-project / per-dependency-add

**Name:** Health & Readiness Check Compiler

| Field | Detail |
|---|---|
| **Input** | Dependency list (PostgreSQL, Redis, BullMQ queues, external service clients, S3), health check spec per dependency (ping query, timeout, degraded vs. critical classification), response schema (`status: ok/degraded/down`, per-dependency breakdown, `version`, `uptime`), liveness vs. readiness distinction. |
| **Output** | `src/health/health.router.ts` (GET `/health` liveness + GET `/ready` readiness routes), `src/health/checks/*.ts` (one check file per dependency), `src/health/health.types.ts` (typed response schema), `src/health/health.test.ts`. |
| **Correctness gates** | (1) `/health` (liveness) returns 200 even when dependencies are down — it only checks that the process is alive. (2) `/ready` (readiness) returns 503 when any critical dependency is unreachable — tested by mocking DB to throw and asserting 503. (3) Response time for both endpoints < 500ms under load — tested with k6 or autocannon assertion. (4) Each check has its own timeout (never blocks indefinitely) — tested by making dependency hang and asserting response within timeout + 50ms. (5) Response body matches typed schema exactly — validated with Zod at test time. (6) Degraded non-critical dependency returns 200 with `status: degraded` (not 503). |
| **Dependencies** | `env-config` (connection strings), `job-scheduler` (scheduler liveness probe), all connection clients (DB, Redis, service clients). |
| **Downstream consumers** | Kubernetes/ECS liveness + readiness probes; `integration-test-suite`. |

---

### 16 · `graphql-schema` — Per-domain-model / per-feature

**Name:** GraphQL Schema Definition Compiler

| Field | Detail |
|---|---|
| **Input** | Domain types (from `ts-schema`), resolver spec (which fields are computed vs. direct, which require DataLoader), auth rules per type/field (public / authenticated / role-based), schema stitching spec if federated, N+1 analysis (which fields must use DataLoader). |
| **Output** | `src/graphql/schema/*.graphql` (SDL files, one per domain), `src/graphql/context.ts` (typed context interface with data sources, user, loaders), `src/graphql/schema.ts` (schema builder aggregating SDL files), `src/graphql/typeDefs.ts` (exported for use by resolver compiler). |
| **Correctness gates** | (1) Schema compiles without errors — `graphql.buildSchema()` runs with zero errors in CI. (2) All custom scalars have registered coerce/serialize/parseLiteral functions. (3) Every Query and Mutation field has a `@auth` directive or is explicitly marked `@public` — lint rule, zero unmarked fields. (4) No field returns `String` where a specific scalar or enum exists — enforced by schema lint rule. (5) Breaking change detection: SDL diff against previous version flags removed fields/types as CI error. (6) TypeScript types generated from SDL (`graphql-codegen`) compile without errors against resolver map. |
| **Dependencies** | `ts-schema` (domain types map to GraphQL types), `auth-middleware` (auth directive implementation). |
| **Downstream consumers** | `graphql-resolver` (implements this schema), `openapi-spec` (if introspection-to-OpenAPI bridge is used), `integration-test-suite`. |

---

### 17 · `graphql-resolver` — Per-type / per-field-group

**Name:** GraphQL Resolver Compiler

| Field | Detail |
|---|---|
| **Input** | GraphQL schema (from `graphql-schema` compiler), data source spec (which repository / service client each field uses), DataLoader spec (batch function per N+1 field), mutation side-effects (events to publish, cache to invalidate), auth rule implementation spec. |
| **Output** | `src/graphql/resolvers/TypeName.resolvers.ts` (resolver map for one type), `src/graphql/loaders/TypeName.loader.ts` (DataLoader per N+1 field), `src/graphql/resolvers/TypeName.resolvers.test.ts` (unit tests with mocked data sources). |
| **Correctness gates** | (1) Resolver map keys match schema type/field names exactly — `graphql-codegen` generated types enforce this at compile time. (2) Every N+1 field identified in spec uses DataLoader — verified by a test that queries a list of N items and asserts batch function called exactly once. (3) Auth directives enforced: unauthenticated resolver call returns `AuthenticationError`, wrong role returns `ForbiddenError` — tested explicitly. (4) No resolver accesses DB directly — only through repository or service client interfaces. (5) Mutations return updated entity, not void — enforced by return type in generated types. (6) DataLoader cache cleared per request (not shared between requests) — asserted by running two separate requests and verifying batch function called twice total. |
| **Dependencies** | `graphql-schema`, `repository`, `cache-layer`, `event-publisher`, `ts-schema`. |
| **Downstream consumers** | `integration-test-suite`, `openapi-spec` (via introspection). |

---

### 18 · `data-transformer` — Per-integration / per-pipeline

**Name:** Data Transformer / Mapper Compiler

| Field | Detail |
|---|---|
| **Input** | Source schema (Zod, from external system or internal model), target schema (Zod, destination model), field mapping spec (source.field → target.field, with transform functions: string casing, date format, currency unit, enum renaming, null handling), bidirectionality requirement, data loss policy (fail on unmapped fields vs. strip silently). |
| **Output** | `src/transformers/sourceName-to-targetName.transformer.ts` (typed transform function), `src/transformers/targetName-to-sourceName.transformer.ts` (reverse, if bidirectional), `src/transformers/sourceName-to-targetName.transformer.test.ts` (property-based tests with `fast-check`). |
| **Correctness gates** | (1) Transform output passes Zod `.parse()` of target schema — no partial or invalid output. (2) Property-based tests (fast-check): for any valid source input, transform produces a valid target — 1000 random inputs. (3) Round-trip test (if bidirectional): `reverse(transform(x))` equals `x` for all test inputs. (4) No data silently dropped unless spec explicitly permits — `strict` mode Zod parse on output. (5) Transform is a pure function — no I/O, no side-effects, verified by `no-side-effects` ESLint rule. (6) All enum mappings are exhaustive — TypeScript `never` check on switch default. |
| **Dependencies** | `ts-schema` (both source and target Zod schemas). |
| **Downstream consumers** | `service-client` (transforms API responses), `event-consumer` (transforms event payloads), `background-job` (transforms pipeline data), `webhook-handler` (transforms provider payloads). |

---

### 19 · `error-catalog` — Per-project / per-domain-add

**Name:** Error Catalog Compiler

| Field | Detail |
|---|---|
| **Input** | Error taxonomy: for each error — code (string enum, e.g. `USER_NOT_FOUND`), human-readable message template, HTTP status code, domain (auth / billing / data / infra), retryable flag, severity (fatal / error / warn), optionally i18n key. |
| **Output** | `src/errors/errors.ts` (typed error class hierarchy extending `Error`), `src/errors/errorCodes.ts` (const enum of all codes), `src/errors/errorFactory.ts` (factory: `createError(code, context?)`), `src/errors/errorHandler.ts` (Express/Fastify global error middleware that maps errors to HTTP responses), `src/errors/errors.test.ts`. |
| **Correctness gates** | (1) Every `errorCode` maps to exactly one HTTP status — no code maps to multiple statuses (bijection enforced by TypeScript map type). (2) Global error handler produces response matching OpenAPI error schema — validated with Zod at test time. (3) `instanceof` checks work across module boundaries — tested by throwing in one module and catching in another. (4) Retryable errors include `Retry-After` header in HTTP response. (5) No unhandled error reaches the client with a raw stack trace — integration test that throws each error type and asserts response body contains no `stack` field. (6) Error codes are stable across releases — breaking change (code rename/removal) detected by snapshot test diff in CI. |
| **Dependencies** | `ts-schema` (error payload type), `env-config` (NODE_ENV controls stack trace inclusion). |
| **Downstream consumers** | All compilers that throw errors: `api-route`, `repository`, `service-client`, `background-job`, `graphql-resolver`, `webhook-handler`. |

---

### 20 · `logger` — Per-project

**Name:** Structured Logger Compiler

| Field | Detail |
|---|---|
| **Input** | Log level policy (per environment), structured field spec (required fields on every log line: `service`, `version`, `environment`, `traceId`, `requestId`, `userId`), sink config (stdout JSON / Datadog / CloudWatch), redaction rules (which fields to mask: passwords, tokens, PII), sampling rate (for high-volume logs). |
| **Output** | `src/logger/logger.ts` (pino or winston singleton, configured per spec), `src/logger/requestLogger.middleware.ts` (HTTP request/response log middleware with `traceId` injection), `src/logger/logger.test.ts` (asserts structured output, redaction, level filtering). |
| **Correctness gates** | (1) All log lines are valid JSON (in production) — tested by capturing stdout and `JSON.parse()`-ing every line. (2) Redacted fields never appear in log output — tested by logging an object containing a password field and asserting output contains `[REDACTED]`. (3) `requestId` and `traceId` present on all request-scoped log lines — tested via AsyncLocalStorage context propagation test. (4) Log level filtering: `DEBUG` lines do not appear in production config — tested by setting `NODE_ENV=production` and asserting `logger.debug()` produces no output. (5) Logger does not throw when passed circular references. (6) Sensitive env var values (from `env-config` secret classification) never logged at any level. |
| **Dependencies** | `env-config` (log level, sink config, service name/version). |
| **Downstream consumers** | Every other compiler — logger is injected as a dependency universally. |

---

### 21 · `integration-test-suite` — Per-feature / per-service

**Name:** Integration Test Suite Compiler

| Field | Detail |
|---|---|
| **Input** | API contract (from `openapi-spec` or `graphql-schema`), seed data spec, environment spec (test DB URL, test Redis, mock external services), list of user flows to cover, error scenario matrix. |
| **Output** | `src/tests/integration/featureName.integration.test.ts` (Supertest or Fastify `inject` test suite), `src/tests/integration/setup.ts` (DB migrate + seed + teardown), `src/tests/integration/mocks/` (MSW or nock handlers for all external services), `vitest.config.integration.ts` (separate config for integration run). |
| **Correctness gates** | (1) Tests run against a real (test) PostgreSQL instance and real Redis — not mocked. (2) Each test begins with a clean DB state — transaction rollback or truncate after each test, verified by asserting table counts reset. (3) All external HTTP calls intercepted by MSW/nock — no real outbound network in tests (asserted by nock's `disableNetConnect()`). (4) Test suite is idempotent — running 10× produces identical pass/fail results. (5) Coverage gate: all documented API endpoints have at least one integration test — enforced by cross-referencing `openapi-spec` route list against test files. (6) Tests pass within 60s — timeout CI gate. |
| **Dependencies** | `api-route`, `repository`, `db-seed`, `openapi-spec` or `graphql-schema`, `error-catalog`, `auth-middleware`. |
| **Downstream consumers** | CI quality gate — no downstream compilers, this is a terminal attester. |

---

### 22 · `db-query-optimizer` — Per-slow-query / per-release

**Name:** Database Query Optimizer Compiler

| Field | Detail |
|---|---|
| **Input** | Query execution plans (EXPLAIN ANALYZE output), slow query log (queries > threshold ms), index spec (proposed composite indexes), perf baseline (p50/p95/p99 query times), row-count projections (table growth estimates). |
| **Output** | New `db-migration` artifact (index creation migration), patched `repository` query rewrites (if sequential scans eliminated), `query-analysis-report.md` (EXPLAIN ANALYZE before/after for each optimised query), optionally updated `cache-layer` TTL recommendations. |
| **Correctness gates** | (1) Every proposed index reduces EXPLAIN ANALYZE cost by ≥ 20% on the target query — asserted by running EXPLAIN on test DB before and after migration. (2) Index does not introduce a write regression > 10% on INSERT/UPDATE benchmarks — measured with pgbench. (3) No index created on a column with cardinality < 10 (would be ignored by planner) — validated by checking `pg_stats.n_distinct`. (4) All slow queries (> threshold) eliminated from slow query log after optimization — verified by re-running load test. (5) EXPLAIN shows `Index Scan` or `Index Only Scan`, not `Seq Scan`, for target queries post-migration. |
| **Dependencies** | `db-migration` (base schema), `repository` (queries being optimized), production or staging EXPLAIN ANALYZE data. |
| **Downstream consumers** | New `db-migration` artifact (index migration), updated `repository`, updated `cache-layer` spec. |

---

## Recommended Compiler Build Order

The network must be built in phases. Compilers within a phase are independent and can be parallelised.

### Phase 0 — Zero-Dependency Primitives

| Compiler | Depends On | Rationale |
|---|---|---|
| `ts-schema` | ✓ **Already built** | All others reference typed schemas. |
| `env-config` | Nothing | Runtime config must exist before any connection is opened. |
| `error-catalog` | `ts-schema`, `env-config` | Errors are thrown by all layers; must exist before any layer under test. |
| `logger` | `env-config` | Injected into every module; must exist before any tested module is built. |

---

### Phase 1 — Data Foundation

| Compiler | Depends On | Rationale |
|---|---|---|
| `db-migration` | ✓ **Already built** | Schema must exist before any DB-touching compiler. |
| `db-seed` | `ts-schema`, `db-migration` | Fixtures needed for all repository and integration tests. |
| `db-query-optimizer` | `db-migration`, `repository` | Runs after repository queries exist; produces new migration artifacts. |

---

### Phase 2 — Infrastructure Clients

| Compiler | Depends On | Rationale |
|---|---|---|
| `service-client` | `ts-schema`, `env-config` | External HTTP clients needed by jobs, routes, and event handlers. |
| `cache-layer` | `env-config`, `ts-schema`, `repository` | Cache wraps repository; must exist before routes or resolvers use it. |
| `rate-limiter` | `env-config`, `auth-middleware` | Middleware applied to routes; must exist before route integration tests. |
| `pagination` | `ts-schema`, `repository` | Wraps repository queries; consumed by routes and resolvers. |

---

### Phase 3 — Messaging & Jobs

| Compiler | Depends On | Rationale |
|---|---|---|
| `event-publisher` | `ts-schema`, `env-config` | Domain events emitted by repository writes; needed before consumers. |
| `background-job` | `ts-schema`, `env-config`, `repository`, `service-client` | Workers depend on typed payloads, DB access, and outbound HTTP. |
| `event-consumer` | `event-publisher`, `ts-schema`, `env-config`, `repository` | Consumers need the envelope type from publisher. |
| `job-scheduler` | `background-job`, `env-config` | Scheduler registers existing job types; nothing to schedule otherwise. |

---

### Phase 4 — HTTP & API Layer

| Compiler | Depends On | Rationale |
|---|---|---|
| `auth-middleware` | ✓ **Already built** | Rate limiter and routes depend on it. |
| `api-route` | ✓ **Already built** | Routes depend on all Phase 0–3 outputs. |
| `webhook-handler` | `ts-schema`, `api-route`, `background-job`, `env-config` | Registers routes + enqueues jobs; needs both layers. |
| `webhook-emitter` | `event-publisher`, `background-job`, `db-migration`, `env-config` | Delivery log needs DB; retries need job infrastructure. |
| `file-upload` | `env-config`, `auth-middleware`, `ts-schema`, `db-migration` | Upload metadata stored in DB; auth required. |
| `health-check` | `env-config`, `job-scheduler` | Aggregates probes from all dependencies; built last in this phase. |

---

### Phase 5 — GraphQL Layer (if applicable)

| Compiler | Depends On | Rationale |
|---|---|---|
| `graphql-schema` | `ts-schema`, `auth-middleware` | SDL defined from domain types; auth directives registered. |
| `graphql-resolver` | `graphql-schema`, `repository`, `cache-layer`, `event-publisher` | Implements the schema using all data-layer outputs. |

---

### Phase 6 — Cross-Cutting Transforms

| Compiler | Depends On | Rationale |
|---|---|---|
| `data-transformer` | `ts-schema` | Pure functions; only depend on Zod schemas. Can be built in parallel with Phase 1. |

---

### Phase 7 — Documentation & Contracts

| Compiler | Depends On | Rationale |
|---|---|---|
| `openapi-spec` | ✓ **Already built** | Aggregates all `api-route` outputs. |

---

### Phase 8 — Quality Gate (Terminal)

| Compiler | Depends On | Rationale |
|---|---|---|
| `integration-test-suite` | `api-route`, `repository`, `db-seed`, `openapi-spec`/`graphql-schema`, `error-catalog`, `auth-middleware` | Requires the full stack to be assembled. Terminal attester — no compiler depends on it. |

---

## Critical Path

```
ts-schema
  └── env-config
        └── logger ──────────────────────┐
        └── error-catalog ───────────────┤
        └── db-migration                 │
              └── db-seed                │
              └── repository             │
                    └── cache-layer      │
                    └── pagination       │
                    └── event-publisher  │
                          └── background-job
                                └── job-scheduler
                                └── webhook-handler
                                └── webhook-emitter
                    └── service-client   │
                                         ▼
                          api-route ──► integration-test-suite
                          graphql-schema
                            └── graphql-resolver
```

**Minimum viable path to a working service (no GraphQL, no events):**
`ts-schema` → `env-config` → `error-catalog` + `logger` → `db-migration` → `db-seed` → `repository` → `api-route` → `integration-test-suite`

**Full event-driven path adds:**
`event-publisher` → `background-job` → `event-consumer` → `job-scheduler`

**GraphQL path adds:**
`graphql-schema` → `graphql-resolver`

---

*Domain Compiler Network — Backend Role Decomposition · 22 Task Types · Engineering Research*
