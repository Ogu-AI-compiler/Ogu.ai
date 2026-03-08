# Backend Developer Role Decomposition for a Domain Compiler Network

## Context

This document decomposes the backend developer role into atomic, repeatable task types for a formal compiler network in a Node.js and TypeScript stack.

Excluded because they already exist:

- `ts-schema`
- `api-route`
- `auth-middleware`
- `db-migration`
- `openapi-spec`

Excluded because they are already planned as shared cross-role compilers:

- `utility-fn`
- `analytics-event`
- `feature-flag`
- `i18n`

Stack assumptions:

- Node.js
- TypeScript
- Express or Fastify or Hapi
- PostgreSQL
- Prisma or Drizzle
- Redis
- BullMQ or similar queue
- REST plus optional GraphQL
- Jest or Vitest

## What counts as a correctness gate

A correctness gate is a binary, automatable check.

Good gate:

- `every outbound HTTP call must set a timeout or AbortSignal`
- `every webhook with signed payloads must verify the signature before business logic`
- `every background job payload must validate against a schema`

Not a good gate:

- `clean architecture`
- `looks maintainable`
- `good performance`

## Summary table

| Compiler | Frequency | Typical input | Typical output |
|---|---|---|---|
| `config-validation-module` | per-project | env contract, defaults, secret list | `src/config/*` |
| `backend-test-harness-config` | per-project | test runner choice, setup rules | `vitest.config.ts`, `jest.config.*`, `test/setup.*` |
| `module-scaffold` | per-project | module boundaries, folder conventions | `src/modules/<module>/**` |
| `queue-topology-module` | per-project | queue names, retry policy, backoff rules | `src/lib/queues/*` |
| `cache-topology-module` | per-project | cache namespaces, TTL policy, invalidation policy | `src/lib/cache/*` |
| `service-client-runtime-module` | per-project | outbound HTTP defaults, retry policy, auth source | `src/lib/http/*` |
| `healthcheck-module` | per-project | dependency list, liveness/readiness policy | `src/lib/health/*` |
| `graphql-schema-module` | per-feature | domain entities, operations, type map | `src/graphql/<feature>/*.schema.ts` or `.graphql` |
| `scheduled-job-module` | per-feature | cron or repeat schedule, target job, timezone | `src/modules/<feature>/jobs/*.schedule.ts` |
| `seed-scenario-module` | per-feature | fixture model, deterministic seed, mode | `prisma/seed.ts` or `src/db/seeds/*` |
| `orm-repository-module` | daily | data access spec, entity shape, ORM choice | `src/modules/<feature>/repositories/*.repo.ts` |
| `domain-service-module` | daily | use case spec, invariants, dependencies | `src/modules/<feature>/services/*.service.ts` |
| `transaction-script-module` | daily | read-modify-write workflow, isolation needs | `src/modules/<feature>/workflows/*.tx.ts` |
| `cache-module` | daily | cache policy, key builder, source of truth | `src/modules/<feature>/cache/*.cache.ts` |
| `service-client-module` | daily | provider spec, auth method, request and response schemas | `src/modules/<feature>/clients/*.client.ts` |
| `job-producer-module` | daily | queue name, payload schema, dedupe policy | `src/modules/<feature>/jobs/*.producer.ts` |
| `job-worker-module` | daily | queue job spec, side effects, retry semantics | `src/workers/*.worker.ts` |
| `event-publisher-module` | daily | event name, version, payload schema, channel | `src/modules/<feature>/events/*.publisher.ts` |
| `event-consumer-module` | daily | subscription spec, idempotency rule, handler flow | `src/modules/<feature>/events/*.consumer.ts` |
| `webhook-processor-module` | daily | provider event catalog, signature rule, dedupe rule | `src/modules/<feature>/webhooks/*.processor.ts` |
| `rate-limit-policy-module` | daily | scope, keying rule, quota, storage rule | `src/lib/rate-limit/*.policy.ts` |
| `graphql-resolver-module` | daily | schema field contract, context contract, service calls | `src/graphql/<feature>/*.resolver.ts` |
| `backend-test-module` | daily | behavior spec, mocks, fixtures, failure modes | `test/**` or co-located `*.test.ts` |

---

## Detailed breakdown

### 1. `config-validation-module`

**Frequency:** per-project

**Input**

- Environment variable list
- Required and optional flags
- Defaults
- Secret and public classification
- Type contract for each key

**Output**

- `src/config/env.ts`
- `src/config/schema.ts`
- `src/config/index.ts`
- `test/config/env.test.ts`

**Correctness gates**

- Every exported config key exists in the validation schema.
- Every schema key is either required or has a default.
- No direct `process.env.*` access exists outside the config module.
- Invalid or missing required config causes startup failure.
- Unknown environment keys are rejected or ignored according to an explicit policy.
- Secret keys are marked in metadata and are not included in safe debug snapshots.

**Dependencies**

- `ts-schema` if you generate typed config objects from schemas.

**Downstream consumers**

- All other compilers.

### 2. `backend-test-harness-config`

**Frequency:** per-project

**Input**

- Jest or Vitest choice
- Node vs jsdom test environment split
- Mocking policy
- Coverage thresholds
- Test path conventions

**Output**

- `vitest.config.ts` or `jest.config.ts`
- `test/setup.ts`
- `test/factories/*`
- `test/helpers/*`

**Correctness gates**

- Test runner config loads without runtime errors.
- Unit tests and integration tests resolve TypeScript paths correctly.
- Global setup registers matchers and teardown hooks.
- Network calls are blocked by default in unit mode unless explicitly mocked.
- Coverage thresholds are machine-readable and enforced in config.

**Dependencies**

- `config-validation-module`

**Downstream consumers**

- `backend-test-module`
- All compilers that emit tests as part of attestation.

### 3. `module-scaffold`

**Frequency:** per-project

**Input**

- Chosen module structure
- Public API rules
- Internal folder conventions
- Import boundary rules

**Output**

- `src/modules/<module>/index.ts`
- `src/modules/<module>/{services,repositories,workflows,clients,events,jobs,webhooks}/`
- `test/<module>/`

**Correctness gates**

- Each module has exactly one public entrypoint.
- Internal folders exist only for enabled capabilities.
- Cross-module imports go through public entrypoints unless explicitly allowed.
- No circular imports across modules.

**Dependencies**

- None beyond repo-level conventions.

**Downstream consumers**

- All feature compilers.

### 4. `queue-topology-module`

**Frequency:** per-project

**Input**

- Queue names
- Queue ownership
- Default retry counts
- Backoff strategy
- Concurrency defaults
- Retention policy for completed and failed jobs

**Output**

- `src/lib/queues/queues.ts`
- `src/lib/queues/defaultJobOptions.ts`
- `src/lib/queues/index.ts`
- `test/queues/queues.test.ts`

**Correctness gates**

- Every queue name is unique.
- Every queue declares retry or explicit no-retry policy.
- Every queue declares retention policy for completed and failed jobs.
- No producer or worker references an undeclared queue.
- Queue names and job names are stable strings, not computed ad hoc.

**Dependencies**

- `config-validation-module`

**Downstream consumers**

- `job-producer-module`
- `job-worker-module`
- `scheduled-job-module`
- `healthcheck-module`

### 5. `cache-topology-module`

**Frequency:** per-project

**Input**

- Cache namespaces
- TTL policy
- Serializer choice
- Invalidation strategy
- Source of truth for each cached record

**Output**

- `src/lib/cache/keys.ts`
- `src/lib/cache/policies.ts`
- `src/lib/cache/index.ts`
- `test/cache/keys.test.ts`

**Correctness gates**

- Every cache family has a namespace.
- Every cache family has explicit TTL or explicit no-expiry policy.
- Cache keys are deterministic functions of declared inputs.
- No duplicate cache key builders exist for the same resource.
- Every cached value has a declared serializer and parser.

**Dependencies**

- `config-validation-module`

**Downstream consumers**

- `cache-module`
- `healthcheck-module`
- `domain-service-module`
- `event-consumer-module`

### 6. `service-client-runtime-module`

**Frequency:** per-project

**Input**

- Default timeout
- Retry policy
- Base auth injection rules
- Logging and redaction rules
- HTTP library choice

**Output**

- `src/lib/http/httpClient.ts`
- `src/lib/http/errors.ts`
- `src/lib/http/retry.ts`
- `test/http/httpClient.test.ts`

**Correctness gates**

- Every outbound request path supports timeout or `AbortSignal`.
- Base URL comes from config, not hardcoded literals.
- Secret headers are redacted in structured logs.
- Retry policy is explicit and only applies to allowlisted conditions.
- Non-2xx responses are normalized into typed client errors.

**Dependencies**

- `config-validation-module`

**Downstream consumers**

- `service-client-module`
- `healthcheck-module`
- `webhook-processor-module`

### 7. `healthcheck-module`

**Frequency:** per-project

**Input**

- Dependency inventory
- Liveness policy
- Readiness policy
- Timeout per dependency
- Optional degraded mode rules

**Output**

- `src/lib/health/liveness.ts`
- `src/lib/health/readiness.ts`
- `src/lib/health/index.ts`
- `test/health/*.test.ts`

**Correctness gates**

- Liveness checks do not depend on remote systems unless explicitly configured.
- Readiness output is machine-readable and per-dependency.
- Every dependency check is bounded by a timeout.
- A failing dependency produces a deterministic unhealthy or degraded result.
- Health modules do not perform destructive operations.

**Dependencies**

- `config-validation-module`
- Optional: `service-client-runtime-module`, `queue-topology-module`, `cache-topology-module`

**Downstream consumers**

- `api-route`
- Deployment startup checks
- Smoke tests

### 8. `graphql-schema-module`

**Frequency:** per-feature

**Input**

- Domain entities
- Query and mutation operations
- Type relationships
- Pagination style

**Output**

- `src/graphql/<feature>/<feature>.schema.ts` or `.graphql`
- `test/graphql/<feature>.schema.test.ts`

**Correctness gates**

- Type names are unique across the GraphQL schema.
- Every field references declared input and output types.
- Every mutation uses a declared input type.
- No orphan type is emitted unless intentionally exported.
- The schema compiles without validation errors.

**Dependencies**

- `ts-schema`
- Optional module boundaries from `module-scaffold`

**Downstream consumers**

- `graphql-resolver-module`
- GraphQL server bootstrap

### 9. `scheduled-job-module`

**Frequency:** per-feature

**Input**

- Schedule expression
- Target queue and job name
- Payload builder
- Timezone if calendar-based schedule
- Catch-up policy

**Output**

- `src/modules/<feature>/jobs/<job>.schedule.ts`
- `test/jobs/<job>.schedule.test.ts`

**Correctness gates**

- Schedule expression parses successfully.
- Timezone is explicit when using calendar semantics.
- Scheduled target references an existing queue and job name.
- Schedule registration id is stable across deploys.
- Catch-up policy is explicit for missed runs.

**Dependencies**

- `queue-topology-module`
- `job-producer-module`

**Downstream consumers**

- Queue bootstrap code
- Monitoring and ops tooling

### 10. `seed-scenario-module`

**Frequency:** per-feature

**Input**

- Fixture entities
- Deterministic seed value
- Mode such as dev, test, demo
- Idempotency expectations

**Output**

- `prisma/seed.ts` or `src/db/seeds/<scenario>.seed.ts`
- `test/seeds/<scenario>.test.ts`

**Correctness gates**

- Running the same seed twice yields the same resulting state or an explicit idempotent merge state.
- Seed data references only existing tables and columns.
- Referential dependencies are inserted in valid order or wrapped in transactions.
- Seed modes are explicit and do not silently mix dev and production data.
- Process exits non-zero on failed seed.

**Dependencies**

- `db-migration`
- `orm-repository-module` or direct ORM access
- `ts-schema`

**Downstream consumers**

- Local development
- Integration tests
- Demo environments

### 11. `orm-repository-module`

**Frequency:** daily

**Input**

- Repository contract
- Entity shape
- Filter, pagination, and sorting rules
- ORM choice: Prisma or Drizzle

**Output**

- `src/modules/<feature>/repositories/<entity>.repo.ts`
- `test/repositories/<entity>.repo.test.ts`

**Correctness gates**

- Repository imports no HTTP framework types.
- Method signatures are fully typed and contain no `any`.
- Paginated reads require explicit stable ordering.
- Mutating methods return typed results or typed domain errors.
- Raw SQL usage is either absent or isolated behind explicit escape hatches.
- Repository methods do not call external network services.

**Dependencies**

- `db-migration`
- `ts-schema`
- `module-scaffold`

**Downstream consumers**

- `domain-service-module`
- `transaction-script-module`
- `seed-scenario-module`
- `job-worker-module`
- `graphql-resolver-module`

### 12. `domain-service-module`

**Frequency:** daily

**Input**

- Use case spec
- Business invariants
- Required repositories
- Required clients
- Cache and event needs

**Output**

- `src/modules/<feature>/services/<useCase>.service.ts`
- `test/services/<useCase>.service.test.ts`

**Correctness gates**

- Service imports no request or response objects.
- Service imports no `process.env` directly.
- Service returns typed success and typed failure states.
- Service either performs no database writes or delegates multi-write flows to `transaction-script-module`.
- Idempotent service specs include an explicit dedupe or unique-key strategy.
- Service side effects are explicit in constructor or factory dependencies.

**Dependencies**

- `orm-repository-module`
- `service-client-module`
- `cache-module`
- `event-publisher-module`
- `config-validation-module`

**Downstream consumers**

- `api-route`
- `job-worker-module`
- `webhook-processor-module`
- `graphql-resolver-module`

### 13. `transaction-script-module`

**Frequency:** daily

**Input**

- Multi-step write workflow
- Isolation requirements
- Rollback expectations
- Idempotency rules

**Output**

- `src/modules/<feature>/workflows/<flow>.tx.ts`
- `test/workflows/<flow>.tx.test.ts`

**Correctness gates**

- All declared writes occur inside a single ORM transaction boundary.
- No outbound HTTP call occurs inside the transaction block.
- Failure path rolls back all writes.
- Isolation level is explicit if the workflow requires it.
- Idempotency key, if required, is read and written atomically.

**Dependencies**

- `orm-repository-module`
- `db-migration`

**Downstream consumers**

- `domain-service-module`
- `webhook-processor-module`
- `job-worker-module`

### 14. `cache-module`

**Frequency:** daily

**Input**

- Cache policy
- Key builder
- Source of truth function
- Invalidation trigger list

**Output**

- `src/modules/<feature>/cache/<resource>.cache.ts`
- `test/cache/<resource>.cache.test.ts`

**Correctness gates**

- All keys come from `cache-topology-module`, not string literals.
- Cached values validate against declared schema before use.
- TTL comes from declared policy, not embedded magic numbers.
- Every write-through or invalidation path is explicit.
- Cache miss path delegates to exactly one source of truth.

**Dependencies**

- `cache-topology-module`
- `ts-schema`
- `orm-repository-module` or `service-client-module`

**Downstream consumers**

- `domain-service-module`
- `graphql-resolver-module`
- `webhook-processor-module`

### 15. `service-client-module`

**Frequency:** daily

**Input**

- Provider API contract
- Auth rules
- Request and response schemas
- Retry and idempotency policy

**Output**

- `src/modules/<feature>/clients/<provider>.client.ts`
- `test/clients/<provider>.client.test.ts`

**Correctness gates**

- All requests use `service-client-runtime-module`.
- Request payloads and responses validate against declared schemas.
- Auth tokens are sourced only from config.
- Each write call has explicit idempotency behavior if retries are enabled.
- 4xx and 5xx responses map to typed errors.
- Timeouts are explicit.

**Dependencies**

- `service-client-runtime-module`
- `config-validation-module`
- `ts-schema`

**Downstream consumers**

- `domain-service-module`
- `job-worker-module`
- `webhook-processor-module`
- `healthcheck-module`

### 16. `job-producer-module`

**Frequency:** daily

**Input**

- Queue target
- Job name
- Payload schema
- Delay, priority, dedupe, and retention requirements

**Output**

- `src/modules/<feature>/jobs/<job>.producer.ts`
- `test/jobs/<job>.producer.test.ts`

**Correctness gates**

- Target queue exists in `queue-topology-module`.
- Payload validates before enqueue.
- Job name is explicit and stable.
- Job dedupe or `jobId` policy is explicit when the job must be idempotent.
- Delay, priority, and retention settings come from declared policy.

**Dependencies**

- `queue-topology-module`
- `ts-schema`

**Downstream consumers**

- `api-route`
- `domain-service-module`
- `webhook-processor-module`
- `scheduled-job-module`

### 17. `job-worker-module`

**Frequency:** daily

**Input**

- Queue and job spec
- Payload schema
- Side effects
- Retry policy
- Idempotency strategy

**Output**

- `src/workers/<job>.worker.ts`
- `test/workers/<job>.worker.test.ts`

**Correctness gates**

- Worker subscribes only to declared queue and job names.
- Payload validates before business logic.
- Success and failure paths are explicit. No silent swallow of exceptions.
- Side effects are idempotent or guarded by a dedupe key.
- Retry-safe errors are distinguishable from terminal errors.
- Worker does not contain undeclared queue config literals.

**Dependencies**

- `queue-topology-module`
- `domain-service-module` or `transaction-script-module`
- `service-client-module`
- `orm-repository-module`

**Downstream consumers**

- Queue runtime
- `healthcheck-module`
- Monitoring and alerting hooks

### 18. `event-publisher-module`

**Frequency:** daily

**Input**

- Event name
- Version
- Channel or topic
- Payload schema
- Delivery semantics

**Output**

- `src/modules/<feature>/events/<event>.publisher.ts`
- `test/events/<event>.publisher.test.ts`

**Correctness gates**

- Event name and version are explicit constants.
- Payload validates against a schema before publish.
- Channel or topic is declared, not ad hoc.
- Published envelope includes event id and timestamp.
- Publisher contains no business branching beyond serialization and dispatch.

**Dependencies**

- `ts-schema`
- Optional Redis or queue runtime config

**Downstream consumers**

- `event-consumer-module`
- `domain-service-module`
- `job-worker-module`

### 19. `event-consumer-module`

**Frequency:** daily

**Input**

- Subscription spec
- Payload schema
- Idempotency rule
- Target side effects

**Output**

- `src/modules/<feature>/events/<event>.consumer.ts`
- `test/events/<event>.consumer.test.ts`

**Correctness gates**

- Consumer subscribes only to declared topics.
- Payload validates before handling.
- Handler idempotency strategy is explicit for at-least-once delivery.
- Failures propagate to retry or dead-letter handling instead of being swallowed.
- Consumer side effects are delegated to services or workflows, not embedded ad hoc.

**Dependencies**

- `event-publisher-module` or shared event contract
- `domain-service-module`
- `cache-module`
- `orm-repository-module`

**Downstream consumers**

- Projections
- Cache invalidation flows
- Async orchestration chains

### 20. `webhook-processor-module`

**Frequency:** daily

**Input**

- Provider event catalog
- Signature verification rule
- Raw body requirement
- Duplicate handling rule
- Async handoff rule

**Output**

- `src/modules/<feature>/webhooks/<provider>.processor.ts`
- `test/webhooks/<provider>.processor.test.ts`

**Correctness gates**

- Signed webhook providers verify the signature before business logic.
- If provider requires raw body verification, the processor accepts raw bytes or raw body input and does not require pre-parsed JSON.
- Duplicate event handling is explicit.
- Unsupported event types resolve to a deterministic ignore path.
- Slow work is delegated to a queue or async workflow if the provider expects fast acknowledgement.
- Processor does not embed route registration logic. That remains the job of `api-route`.

**Dependencies**

- `api-route`
- `service-client-module` or provider SDK wrapper
- `job-producer-module` or `domain-service-module`
- `config-validation-module`

**Downstream consumers**

- Payment flows
- Sync pipelines
- Event-driven domain services

### 21. `rate-limit-policy-module`

**Frequency:** daily

**Input**

- Scope such as route, user, IP, API key, tenant
- Keying rule
- Quota and time window
- Response policy
- Storage backend rule

**Output**

- `src/lib/rate-limit/<policy>.policy.ts`
- `test/rate-limit/<policy>.test.ts`

**Correctness gates**

- Every policy declares `key`, `limit`, and `window` explicitly.
- The key function is deterministic.
- The exceed path maps to an explicit machine-readable result.
- Shared policies specify a distributed backing store if multi-instance behavior is required.
- Policies can be attached by `api-route`, webhook routes, or GraphQL handlers without modification.

**Dependencies**

- `config-validation-module`
- Optional Redis configuration

**Downstream consumers**

- `api-route`
- `webhook-processor-module`
- `graphql-resolver-module`

### 22. `graphql-resolver-module`

**Frequency:** daily

**Input**

- GraphQL schema field or operation contract
- Context contract
- Target service or repository
- Optional batching strategy

**Output**

- `src/graphql/<feature>/<feature>.resolver.ts`
- `test/graphql/<feature>.resolver.test.ts`

**Correctness gates**

- Resolver map keys match declared schema field names.
- Resolver args and return types conform to the schema.
- Resolver uses context dependencies, not global mutable state.
- Mutations delegate writes to services or workflows, not inline repository chains.
- Resolver error mapping is explicit.
- High-cardinality list or relation fields declare batching or explicit no-batching policy.

**Dependencies**

- `graphql-schema-module`
- `domain-service-module` or `orm-repository-module`
- Optional `cache-module`

**Downstream consumers**

- GraphQL server runtime
- Client-facing API behavior

### 23. `backend-test-module`

**Frequency:** daily

**Input**

- Behavior spec
- Happy path
- Failure modes
- Fixtures and mocks
- Idempotency and retry cases if relevant

**Output**

- `test/**/*.test.ts`
- Or co-located `*.test.ts`

**Correctness gates**

- Subject under test is imported through its public API.
- Test covers at least one happy path and one failure path.
- For idempotent flows, repeated execution case is asserted.
- Unit tests do not hit live network or live external services.
- Async tests fail on rejected promises and unhandled errors.

**Dependencies**

- `backend-test-harness-config`
- Target runtime module

**Downstream consumers**

- Attestation pipeline for every compiler

---

## Important edge cases covered by this decomposition

### Background jobs

The backend role is not just `job-worker-module`. It splits into three distinct task types:

- `queue-topology-module`
- `job-producer-module`
- `job-worker-module`
- `scheduled-job-module`

This matters because queue declaration, enqueue semantics, and execution semantics fail in different ways and therefore need different compilers.

### Caching layer

Caching also splits into two task types:

- `cache-topology-module` for keyspace, TTL, serialization rules
- `cache-module` for actual read-through, write-through, and invalidation flows

This avoids a common anti-pattern where every service invents keys and TTLs independently.

### Webhooks

Do not treat webhooks as ordinary routes. The route is already covered by `api-route`. What is missing is the processor below it:

- Signature verification
- Raw body handling
- Duplicate event defense
- Fast acknowledgement plus async handoff

That is why `webhook-processor-module` is separate.

### Rate limiting

Rate limiting is not a route compiler. It is a reusable backend policy compiler consumed by routes, webhooks, and GraphQL handlers.

### Data seeding

Seeding is its own compiler because it has distinct correctness rules:

- deterministic output when a seed is supplied
- idempotent re-run behavior
- valid foreign-key ordering

### Service clients

Outbound integrations deserve two layers:

- `service-client-runtime-module` for shared transport guarantees
- `service-client-module` for provider-specific contracts

Without that split, every provider client ends up re-implementing timeout, retry, and redaction logic.

### Event publishing and consumption

Publishing and consuming are different task types because they fail on different boundaries:

- publisher correctness is about event shape and dispatch
- consumer correctness is about validation, idempotency, and retry-safe handling

### Health checks

Health checks are backend code, not DevOps-only concerns. The backend developer still writes the functions that determine whether the service is alive or ready.

### Config validation

Config validation is one of the highest leverage per-project compilers. It eliminates a huge class of runtime failures before any route, service, queue, or worker starts.

---

## Dependency-ordered build recommendation

The goal is to build compilers in an order that maximizes leverage while respecting hard dependencies.

### Phase 1: project foundations

1. `config-validation-module`
2. `backend-test-harness-config`
3. `module-scaffold`
4. `service-client-runtime-module`
5. `queue-topology-module`
6. `cache-topology-module`
7. `healthcheck-module`

Why first:

- Every other compiler depends on config.
- Tests are required for binary attestation.
- Queue and cache compilers need central registries before daily compilers can reuse them safely.

### Phase 2: highest-value daily compilers

8. `orm-repository-module`
9. `domain-service-module`
10. `transaction-script-module`
11. `service-client-module`
12. `cache-module`
13. `backend-test-module`

Why next:

- This layer captures the core backend work that happens every day.
- These compilers are reused by routes, jobs, GraphQL, and webhooks.

### Phase 3: async and event-driven backends

14. `job-producer-module`
15. `job-worker-module`
16. `event-publisher-module`
17. `event-consumer-module`
18. `scheduled-job-module`

Why here:

- They depend on services, repositories, clients, queues, and tests.
- They unlock background processing, retries, and asynchronous workflows.

### Phase 4: external integration surfaces

19. `webhook-processor-module`
20. `rate-limit-policy-module`

Why here:

- Both are thin orchestration layers over already-compiled service and async primitives.
- Both are reused by HTTP routes or transport adapters that you already compile elsewhere.

### Phase 5: optional GraphQL surface

21. `graphql-schema-module`
22. `graphql-resolver-module`

Why later:

- GraphQL is optional in your stack.
- Resolvers should sit on top of compiled services and repositories, not invent business logic inline.

### Phase 6: environment and lifecycle support

23. `seed-scenario-module`

Why last:

- Useful and important, but it does not usually block feature delivery.
- It depends on stable repositories, schemas, and migrations.

---

## Recommended priority if you want daily tasks first

If the rule is "daily first", but you still want to respect prerequisites, the practical order is:

1. `config-validation-module`
2. `backend-test-harness-config`
3. `module-scaffold`
4. `service-client-runtime-module`
5. `queue-topology-module`
6. `cache-topology-module`
7. `orm-repository-module`
8. `domain-service-module`
9. `transaction-script-module`
10. `service-client-module`
11. `cache-module`
12. `backend-test-module`
13. `job-producer-module`
14. `job-worker-module`
15. `event-publisher-module`
16. `event-consumer-module`
17. `webhook-processor-module`
18. `rate-limit-policy-module`
19. `graphql-schema-module`
20. `graphql-resolver-module`
21. `scheduled-job-module`
22. `healthcheck-module`
23. `seed-scenario-module`

That order gives you the fastest path to compilers that backend developers actually touch every day, while still building enough project-level substrate to make those compilers reliable.

---

## Short conclusion

The backend role decomposes cleanly into five layers:

1. Project foundations: config, tests, module boundaries, queue and cache topology
2. Core business code: repositories, services, transactions, clients, cache wrappers
3. Async execution: producers, workers, scheduled jobs
4. Integration surfaces: webhooks, rate limits, GraphQL
5. Lifecycle support: health checks, seeding

The most important design choice is not to compile transport handlers again. Since `api-route` already exists, the highest-value missing compilers are the reusable business and async primitives underneath transport.

---

## Technical grounding used for the gates

The binary gates in this document are aligned with official or reference documentation for the relevant stack, especially on these points:

- BullMQ queue declarations, workers, retries, rate limits, unique job ids, and job retention
- Prisma and Drizzle transaction semantics and deterministic seeding
- Fastify env validation and rate limiting plugins
- Node.js fetch timeouts through `AbortSignal`
- Node.js process signal handling for shutdown-aware health and workers
- Node.js crypto HMAC and constant-time comparison for signature verification
- Stripe webhook raw body verification, duplicate-event handling, and fast 2xx acknowledgement
- Redis Pub/Sub delivery model and its fire-and-forget behavior
- GraphQL.js schema and resolver model

Reference URLs:

- https://docs.bullmq.io/guide/queues
- https://docs.bullmq.io/guide/workers
- https://docs.bullmq.io/guide/rate-limiting
- https://docs.bullmq.io/guide/jobs/job-ids
- https://docs.bullmq.io/guide/queues/auto-removal-of-jobs
- https://docs.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions
- https://orm.drizzle.team/docs/transactions
- https://orm.drizzle.team/docs/kit-seed-data
- https://orm.drizzle.team/docs/cache
- https://github.com/fastify/fastify-env
- https://github.com/fastify/fastify-rate-limit
- https://nodejs.org/api/process.html
- https://nodejs.org/learn/getting-started/fetch
- https://nodejs.org/api/http.html
- https://nodejs.org/api/crypto.html
- https://docs.stripe.com/webhooks/signatures
- https://docs.stripe.com/webhooks
- https://redis.io/docs/latest/develop/pubsub/
- https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/
- https://github.com/graphql/graphql-js

