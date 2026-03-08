# Backend Developer Role Decomposition: Domain Compiler Network

**Context:** Architecture spec for a Backend Domain Compiler Network targeting a modern Node.js ecosystem (TypeScript, Express/Fastify, PostgreSQL, Prisma/Drizzle, Redis, BullMQ).
**Excluded Compilers (Already Built/Shared):** `ts-schema`, `api-route`, `auth-middleware`, `db-migration`, `openapi-spec`, `utility-fn`, `analytics-event`, `feature-flag`, `i18n`.

---

## 1. Summary of Atomic Task Types

| Task Name (Compiler)      | Frequency                | Input                                        | Output                                  |
| :------------------------ | :----------------------- | :------------------------------------------- | :-------------------------------------- |
| **`gen-env-config`**      | Per-project / Occasional | Required env vars list, default values       | `config.ts`, `env.schema.ts`            |
| **`gen-db-schema`**       | Per-feature              | Entity relations spec, indexes               | `schema.prisma` / `schema.ts` (Drizzle) |
| **`gen-db-query`**        | Per-feature              | Data access intent, CRUD operations          | `repository.ts`, `.test.ts`             |
| **`gen-cache-accessor`**  | Per-feature              | Data structure, TTL requirements             | `cache.ts` (Redis wrappers)             |
| **`gen-ext-client`**      | Per-feature              | External OpenAPI spec / API docs             | `client.ts`, type definitions           |
| **`gen-queue-worker`**    | Per-feature              | Job payload spec, retry policy               | `worker.ts`, `publisher.ts`             |
| **`gen-event-pubsub`**    | Per-feature              | Domain event schema, subscriber list         | `events.ts`, topic mappings             |
| **`gen-webhook-handler`** | Per-feature              | Incoming payload spec, signature secret      | `webhook.ts`, verification logic        |
| **`gen-rate-limiter`**    | Per-project / Occasional | Policy (requests per window), key strategy   | `limiter.ts`, middleware wrappers       |
| **`gen-db-seed`**         | Per-feature / Occasional | Entity mock constraints, relationships       | `seed.ts`                               |
| **`gen-health-check`**    | Per-project / Rare       | List of critical infrastructure dependencies | `health.ts` (Liveness/Readiness probes) |

---

## 2. Detailed Task Breakdown

### 2.1. `gen-env-config` (Config Validation)

- **Frequency:** Per-project / Occasional.
- **Input:** JSON mapping of required environment variables, their types (string, url, port), and optional defaults.
- **Output:** A strict Zod/TypeBox schema file and an exported typed `config` object.
- **Correctness gates:**
  - **AST Gate:** Global `process.env` MUST NOT be accessed anywhere outside this generated file across the entire codebase.
  - **Compilation Gate:** Must throw a synchronous error on initialization if a required variable is missing.
- **Dependencies:** None.
- **Downstream consumers:** ALL other compilers (DB, Redis, external clients rely on this config).

### 2.2. `gen-db-schema` (ORM Models)

- **Frequency:** Per-feature.
- **Input:** Entity intent, relationships (1:1, 1:n, n:m), indexing requirements.
- **Output:** Prisma schema definitions (`.prisma`) or Drizzle schema files (`.ts`).
- **Correctness gates:**
  - **Tooling Gate:** Must successfully pass `prisma validate` or `drizzle-kit check`.
  - **Constraint Gate:** All foreign keys must have explicit `onDelete` and `onUpdate` referential actions defined.
  - **Security Gate:** Passwords or secret columns must be explicitly omitted from default selection types (if supported by the ORM generation).
- **Dependencies:** None.
- **Downstream consumers:** `db-migration` (existing), `gen-db-query`, `gen-db-seed`.

### 2.3. `gen-db-query` (Data Access Layer / Repositories)

- **Frequency:** Per-feature.
- **Input:** Query intent (e.g., "Find user by email with active subscriptions"), pagination requirements.
- **Output:** Typed data access functions / repository class.
- **Correctness gates:**
  - **Type Gate:** Return types must strictly map to validated `ts-schema` domain models, not raw ORM types (to prevent database detail leakage).
  - **AST Gate:** No raw SQL template literals allowed without utilizing the ORM's parameterized query functions (SQL injection prevention).
- **Dependencies:** `gen-db-schema`, `ts-schema` (existing).
- **Downstream consumers:** `api-route` (existing), `gen-queue-worker`, `gen-db-seed`.

### 2.4. `gen-cache-accessor` (Caching Layer)

- **Frequency:** Per-feature.
- **Input:** Caching intent, key naming strategy, TTL (Time-To-Live) rules, eviction policy.
- **Output:** Redis get/set wrapper functions with built-in serialization.
- **Correctness gates:**
  - **Architecture Gate:** Cache keys MUST be generated via a formalized prefixing function (e.g., `tenantId:resource:id`) to prevent collisions.
  - **Constraint Gate:** Every `set` operation must include a defined TTL parameter.
- **Dependencies:** `gen-env-config` (for Redis URI), `ts-schema` (existing).
- **Downstream consumers:** `api-route` (existing), `gen-db-query`.

### 2.5. `gen-ext-client` (Service Clients)

- **Frequency:** Per-feature.
- **Input:** Third-party OpenAPI spec or defined REST/GraphQL intent, authentication method.
- **Output:** Typed HTTP client (e.g., Axios/Fetch wrappers).
- **Correctness gates:**
  - **Resilience Gate:** Must implement a retry mechanism (e.g., exponential backoff) and a timeout configuration.
  - **Security Gate:** Must implement request/response interceptors that strip or mask PII (Authorization headers, API keys) before passing to any logging utility.
- **Dependencies:** `gen-env-config`, `ts-schema` (existing).
- **Downstream consumers:** `api-route` (existing), `gen-queue-worker`.

### 2.6. `gen-queue-worker` (Background Jobs)

- **Frequency:** Per-feature.
- **Input:** Job payload schema, concurrency intent, retry/backoff policy (e.g., BullMQ job definition).
- **Output:** Publisher function and Worker processor function.
- **Correctness gates:**
  - **Idempotency Gate:** Worker AST must wrap its core logic in a database transaction or utilize a distributed lock.
  - **Error Handling Gate:** Worker must implement a `catch` block that reports to a centralized error tracker and explicitly returns a failed state, rather than crashing the Node process.
- **Dependencies:** `gen-env-config`, `ts-schema` (existing), `gen-db-query`, `gen-ext-client`.
- **Downstream consumers:** `api-route` (existing), `gen-webhook-handler`.

### 2.7. `gen-event-pubsub` (Event Publishing)

- **Frequency:** Per-feature.
- **Input:** Domain event intent (e.g., `UserCreated`), payload schema.
- **Output:** Event emitter/publisher interfaces and topic definitions.
- **Correctness gates:**
  - **Type Gate:** Event payloads must strictly conform to a `ts-schema` registry.
  - **Architecture Gate:** Event names must follow a strict `<Domain>:<Entity>:<Action>` nomenclature (regex validation).
- **Dependencies:** `ts-schema` (existing).
- **Downstream consumers:** `api-route` (existing), `gen-queue-worker`, `gen-db-query`.

### 2.8. `gen-webhook-handler` (Incoming Webhooks)

- **Frequency:** Per-feature.
- **Input:** Webhook source intent (e.g., Stripe, GitHub), signature header name, payload schema.
- **Output:** Webhook route logic, signature verification utility.
- **Correctness gates:**
  - **Security Gate:** MUST contain cryptographic signature verification (HMAC/SHA) logic comparing the incoming header to a secret from `gen-env-config`.
  - **Architecture Gate:** Must acknowledge the webhook (HTTP 200/202) _before_ or _independent of_ processing heavy logic (enforcing delegation to `gen-queue-worker`).
- **Dependencies:** `gen-env-config`, `ts-schema` (existing), `gen-queue-worker`.
- **Downstream consumers:** `api-route` (existing).

### 2.9. `gen-rate-limiter` (Rate Limiting)

- **Frequency:** Per-project / Occasional.
- **Input:** Limits intent (e.g., 100 req / 15 min per IP/User ID).
- **Output:** Redis-backed rate limiting middleware/utility.
- **Correctness gates:**
  - **Header Gate:** Must append standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers to the HTTP response.
  - **Fallback Gate:** Must fail open (allow request) or fallback to in-memory limits if the Redis connection fails.
- **Dependencies:** `gen-env-config`.
- **Downstream consumers:** `api-route` (existing).

### 2.10. `gen-db-seed` (Data Seeding)

- **Frequency:** Per-feature / Occasional.
- **Input:** Desired mock data volume, relational constraints.
- **Output:** Executable seeding scripts.
- **Correctness gates:**
  - **Environment Gate:** Script MUST verify `NODE_ENV !== 'production'` before executing any operations.
  - **Idempotency Gate:** Must utilize upserts (`create/update`) or wipe tables before insertion to ensure repeatable runs.
- **Dependencies:** `gen-db-schema`, `gen-db-query`.
- **Downstream consumers:** Testing suites, Local dev environments.

### 2.11. `gen-health-check` (Probes)

- **Frequency:** Per-project / Rare.
- **Input:** List of critical services (DB, Redis, Queue).
- **Output:** Express/Fastify route handler for `/healthz` and `/readyz`.
- **Correctness gates:**
  - **Timeout Gate:** Internal checks (e.g., `SELECT 1` on DB) must strictly timeout under 3000ms.
  - **Format Gate:** Must output a flat JSON structure: `{"status": "ok" | "error", "services": {...}}`.
- **Dependencies:** `gen-env-config`, `gen-db-schema`, `gen-cache-accessor`.
- **Downstream consumers:** `api-route` (existing), Infrastructure (Kubernetes/Load Balancers).

---

## 3. Recommended Build Order (Dependency Graph)

To compile the backend network successfully, tasks must be executed from foundational infrastructure configuration up to the HTTP delivery layer.

**Layer 0: Core Foundation**

1. `gen-env-config` — Required to establish connection strings and secrets for everything else.
2. `ts-schema` _(Existing)_ — The source of truth for all types.

**Layer 1: Persistence & Connections** 3. `gen-db-schema` — Requires nothing, but defines the database state. 4. `db-migration` _(Existing)_ — Applies Layer 1 outputs. 5. `gen-cache-accessor` — Requires config (Redis URI) and schemas. 6. `gen-ext-client` — Requires config (API Keys) and schemas.

**Layer 2: Data Access & Domain Definitions** 7. `gen-db-query` — Depends on the DB schema and generated types. 8. `gen-event-pubsub` — Defines internal communication topics. 9. `gen-rate-limiter` — Requires config and caching logic.

**Layer 3: Asynchronous Logic & Integrations** 10. `gen-queue-worker` — Consumes DB queries, external clients, and config. 11. `gen-webhook-handler` — Validates using config, offloads work to queues. 12. `gen-db-seed` — Uses schemas and DB queries to populate initial states.

**Layer 4: Delivery & Operations (The Output)** 13. `gen-health-check` — Pings the DB, Redis, and queues to ensure Layer 1-3 health. 14. `auth-middleware` _(Existing)_ — Uses config and db-queries. 15. `api-route` _(Existing)_ — The culmination: binds DB queries, queue publishers, webhooks, rate limiters, and cache accessors to HTTP endpoints. 16. `openapi-spec` _(Existing)_ — Generates docs based on the final routes and schemas.
