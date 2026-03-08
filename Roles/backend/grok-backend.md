Backend Developer Role Decomposition
Summary Table

Task NameFrequencyInputOutputCreate ORM ModelPer-featureData entity spec (e.g., fields, relations)ORM schema file (e.g., schema.prisma or schema.ts for Drizzle)Create RepositoryPer-featureData access spec (e.g., CRUD operations needed)Repository file (e.g., userRepository.ts)Create ServicePer-featureBusiness logic spec (e.g., operations, validations)Service file (e.g., userService.ts)Create Queue JobPer-featureJob spec (e.g., task to run asynchronously)Job file (e.g., emailJob.ts)Create Queue ProcessorPer-featureProcessing spec (e.g., handler for queue jobs)Processor file (e.g., queueProcessor.ts)Create Cache FunctionPer-featureCaching spec (e.g., key patterns, TTL)Cache wrapper file (e.g., cache.ts)Create Webhook HandlerPer-featureWebhook spec (e.g., payload validation, actions)Webhook handler file (e.g., stripeWebhook.ts)Create Rate LimiterPer-projectLimiting spec (e.g., rules per route or IP)Rate limiter middleware file (e.g., rateLimiter.ts)Create Seed ScriptPer-projectSeeding spec (e.g., initial data sets)Seed script file (e.g., seed.ts)Create API ClientPer-featureExternal API spec (e.g., endpoints, auth)Client file (e.g., stripeClient.ts)Create Event PublisherPer-featureEvent spec (e.g., topics, payloads)Publisher file (e.g., eventPublisher.ts)Create Health CheckPer-projectMonitoring spec (e.g., checks for DB, Redis)Health check file (e.g., health.ts)Create Config ValidatorPer-projectConfig spec (e.g., env vars to validate)Config validation file (e.g., config.ts)Create GraphQL ResolverPer-featureResolver spec (e.g., query/mutation fields)Resolver file (e.g., userResolver.ts)Create Error HandlerPer-projectError spec (e.g., global error formats)Error handler middleware file (e.g., errorHandler.ts)
Detailed Breakdown Per Task
Create ORM Model

Name: Create ORM Model
Frequency: Per-feature
Input: Data entity spec (e.g., fields, relations, constraints in natural language or JSON)
Output: ORM schema file (e.g., schema.prisma or schema.ts for Drizzle defining models)
Correctness gates: Schema compiles without errors; relations resolve (no circular deps); fields match ts-schema types; lint passes; no duplicate model names
Dependencies: ts-schema (for TypeScript types)
Downstream consumers: Create Repository, Create Seed Script, db-migration (existing)

Create Repository

Name: Create Repository
Frequency: Per-feature
Input: Data access spec (e.g., CRUD methods, queries needed)
Output: Repository file (e.g., userRepository.ts with functions like findById, create)
Correctness gates: Types match ORM model; queries compile; unit tests pass (mocked DB); no SQL injection risks; exported correctly
Dependencies: Create ORM Model
Downstream consumers: Create Service, Create Queue Job, Create GraphQL Resolver

Create Service

Name: Create Service
Frequency: Per-feature
Input: Business logic spec (e.g., operations like registerUser, including transactions)
Output: Service file (e.g., userService.ts with methods calling repos, handling logic)
Correctness gates: Methods typed with ts-schema; integration tests pass; handles errors; immutable operations; no direct DB access
Dependencies: Create Repository, Create Cache Function
Downstream consumers: api-route (existing), Create Queue Job, Create Webhook Handler, Create GraphQL Resolver

Create Queue Job

Name: Create Queue Job
Frequency: Per-feature
Input: Job spec (e.g., async task like sendEmail, with payload)
Output: Job file (e.g., emailJob.ts defining job handler for BullMQ)
Correctness gates: Job handler typed; retries configured; tests simulate queue; no blocking ops; idempotent
Dependencies: Create Service, Create API Client
Downstream consumers: Create Queue Processor

Create Queue Processor

Name: Create Queue Processor
Frequency: Per-feature
Input: Processing spec (e.g., worker setup for queue)
Output: Processor file (e.g., queueProcessor.ts setting up BullMQ worker)
Correctness gates: Worker starts without errors; processes jobs; error logging; concurrency limits; tests queue flow
Dependencies: Create Queue Job
Downstream consumers: None (runs independently)

Create Cache Function

Name: Create Cache Function
Frequency: Per-feature
Input: Caching spec (e.g., cache get/set for user data, with invalidation)
Output: Cache wrapper file (e.g., cache.ts with Redis client functions)
Correctness gates: Cache ops atomic; TTL enforced; tests hit/miss; invalidation triggers; no race conditions
Dependencies: ts-schema
Downstream consumers: Create Service, Create Repository, Create GraphQL Resolver

Create Webhook Handler

Name: Create Webhook Handler
Frequency: Per-feature
Input: Webhook spec (e.g., signature verification, payload handling)
Output: Webhook handler file (e.g., stripeWebhook.ts integrated with api-route)
Correctness gates: Verifies signatures; handles payloads with ts-schema; tests simulate webhooks; idempotent; 200 OK response
Dependencies: Create Service, auth-middleware (existing)
Downstream consumers: Create Event Publisher

Create Rate Limiter

Name: Create Rate Limiter
Frequency: Per-project
Input: Limiting spec (e.g., 100 req/min per IP, using Redis)
Output: Rate limiter middleware file (e.g., rateLimiter.ts)
Correctness gates: Enforces limits; tests exceed thresholds; headers set (X-RateLimit); no false positives; configurable
Dependencies: None
Downstream consumers: api-route (existing)

Create Seed Script

Name: Create Seed Script
Frequency: Per-project
Input: Seeding spec (e.g., insert users, roles)
Output: Seed script file (e.g., seed.ts using ORM to populate DB)
Correctness gates: Runs without errors; idempotent (check exists); matches ORM models; tests seeded data; cleans up if needed
Dependencies: Create ORM Model
Downstream consumers: None (dev tool)

Create API Client

Name: Create API Client
Frequency: Per-feature
Input: External API spec (e.g., endpoints, auth for Stripe)
Output: Client file (e.g., stripeClient.ts with typed methods)
Correctness gates: Requests typed with ts-schema; mocks for tests pass; handles rate limits; error mapping; auth secure
Dependencies: ts-schema
Downstream consumers: Create Service, Create Queue Job, Create Webhook Handler

Create Event Publisher

Name: Create Event Publisher
Frequency: Per-feature
Input: Event spec (e.g., publish 'user.created' to Redis pub/sub)
Output: Publisher file (e.g., eventPublisher.ts with publish functions)
Correctness gates: Events typed; publishes async; tests subscription; no lost messages; schema validation
Dependencies: ts-schema
Downstream consumers: Create Service, Create Webhook Handler

Create Health Check

Name: Create Health Check
Frequency: Per-project
Input: Monitoring spec (e.g., ping DB, Redis)
Output: Health check file (e.g., health.ts as middleware or route)
Correctness gates: Returns 200 if healthy; tests failures; includes deps status; fast response; no sensitive info
Dependencies: None
Downstream consumers: api-route (existing)

Create Config Validator

Name: Create Config Validator
Frequency: Per-project
Input: Config spec (e.g., env vars like DB_URL)
Output: Config validation file (e.g., config.ts parsing/validating process.env)
Correctness gates: Validates at startup; throws on invalid; types output; tests missing vars; uses Zod from ts-schema
Dependencies: ts-schema
Downstream consumers: All (app bootstrap)

Create GraphQL Resolver

Name: Create GraphQL Resolver
Frequency: Per-feature
Input: Resolver spec (e.g., query getUser, mutation createUser)
Output: Resolver file (e.g., userResolver.ts calling services)
Correctness gates: Resolves types; auth integrated; tests queries; no N+1; schema compiles
Dependencies: Create Service, auth-middleware (existing)
Downstream consumers: openapi-spec (existing, for GraphQL if applicable)

Create Error Handler

Name: Create Error Handler
Frequency: Per-project
Input: Error spec (e.g., format responses, log levels)
Output: Error handler middleware file (e.g., errorHandler.ts)
Correctness gates: Catches all errors; formats JSON; status codes correct; tests throws; no stack in prod
Dependencies: None
Downstream consumers: api-route (existing)

Recommended Build Order for Compiler Network
Considering the dependency graph, build compilers in an order that resolves prerequisites first. Leverage existing compilers (ts-schema, api-route, etc.) as starting points. Recommended order:

Create Rate Limiter (no deps)
Create Health Check (no deps)
Create Error Handler (no deps)
Create Config Validator (deps: ts-schema existing)
Create ORM Model (deps: ts-schema existing)
Create Cache Function (deps: ts-schema existing)
Create API Client (deps: ts-schema existing)
Create Event Publisher (deps: ts-schema existing)
Create Repository (deps: 5)
Create Service (deps: 9, 6)
Create Queue Job (deps: 10, 7)
Create Queue Processor (deps: 11)
Create Webhook Handler (deps: 10, auth-middleware existing)
Create Seed Script (deps: 5)
Create GraphQL Resolver (deps: 10, auth-middleware existing)
