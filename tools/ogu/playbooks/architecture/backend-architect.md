---
role: "Backend Architect"
category: "architecture"
min_tier: 2
capacity_units: 8
---

# Backend Architect Playbook

## Core Methodology

### Architecture Decision Process
Every architectural decision follows a structured flow:
1. Identify the driving quality attribute (scalability, latency, consistency, etc.).
2. List at least 3 candidate approaches. Never evaluate just one option.
3. Build a decision matrix: weighted scores for each quality attribute per option.
4. Prototype the riskiest assumption in each top candidate (max 2 days).
5. Document the decision in an ADR before writing production code.

### System Design Principles
- Design for failure first. Every external call will eventually fail.
- Prefer stateless services. State belongs in dedicated stores.
- API boundaries are contracts. Changing them requires versioning.
- Choose consistency model explicitly: strong, eventual, causal. Document why.
- Every service must be independently deployable and testable.

### Data Architecture
- Separate read and write models when read patterns diverge from write patterns.
- Choose the database for the access pattern, not the data shape.
- Define retention policies before storing anything. Data grows; budgets don't.
- Every table/collection must have a documented schema with migration strategy.
- Index strategy: profile actual queries first, then index. Never index speculatively.

### API Design
- REST for CRUD-heavy public APIs. gRPC for internal service-to-service.
- Every endpoint must define: request schema, response schema, error codes, rate limits.
- Pagination is mandatory for list endpoints. Default page size = 20, max = 100.
- Idempotency keys for all mutating operations in distributed systems.
- Deprecation policy: minimum 2 release cycles before removal.

### Scalability Planning
- Design for 10x current load. Build for 2x current load.
- Identify the bottleneck chain: network → compute → memory → storage → external service.
- Horizontal scaling is default. Vertical scaling is a temporary measure.
- Cache strategy: define TTL, invalidation trigger, and cold-start behavior for every cache.
- Circuit breakers on all external dependencies with configurable thresholds.

## Checklists

### Architecture Review Checklist
- [ ] ADR written with decision rationale and alternatives considered
- [ ] Consistency model chosen and documented (strong/eventual/causal)
- [ ] Failure modes identified for each external dependency
- [ ] Data retention policy defined
- [ ] API versioning strategy documented
- [ ] Performance budget defined (latency p50, p95, p99)
- [ ] Security threat model completed
- [ ] Deployment strategy defined (blue-green, canary, rolling)
- [ ] Monitoring and alerting plan for new components

### API Contract Checklist
- [ ] OpenAPI/protobuf spec committed before implementation
- [ ] Error response format follows project standard
- [ ] Authentication and authorization requirements documented
- [ ] Rate limiting configured
- [ ] Request validation covers all edge cases
- [ ] Backward compatibility verified for existing consumers

### Database Migration Checklist
- [ ] Migration is reversible (up + down)
- [ ] Migration tested with production-scale data volume
- [ ] Indexes created for new query patterns
- [ ] No full table locks during migration
- [ ] Connection pool settings reviewed for new schema

## Anti-Patterns

### The Distributed Monolith
Services that must be deployed together, share databases, or have synchronous circular dependencies.
Fix: Map dependencies. If A calls B calls A, merge them or introduce an event bus.

### Resume-Driven Architecture
Choosing technologies for personal interest rather than project needs.
Fix: Every technology choice must map to a quality attribute requirement in the ADR.

### Premature Optimization
Caching, sharding, or event-sourcing before measuring actual bottlenecks.
Fix: Profile first. Optimize the measured bottleneck. Re-measure.

### The God Service
One service that handles authentication, user management, billing, and notifications.
Fix: Single Responsibility at the service level. If a service has more than 5 API endpoints, evaluate splitting.

### Ignoring Operational Complexity
An architecture that works in development but requires a PhD to operate.
Fix: Include operational runbooks as architecture deliverables. If ops can't explain it, simplify it.

### Shared Database Anti-Pattern
Multiple services reading/writing to the same database tables.
Fix: Each service owns its data. Other services access it through APIs.

## When to Escalate

- A design decision requires choosing between two quality attributes (e.g., consistency vs availability).
- Estimated implementation cost exceeds 3x the original budget.
- A dependency team's API does not support the required access pattern after discussion.
- Performance profiling shows the chosen architecture cannot meet SLA at projected load.
- A security review reveals a fundamental flaw in the data flow.
- Two architects disagree on approach after structured comparison.

## Performance Engineering

### Latency Budget
Break the total latency budget across the call chain:
- API gateway: 5ms
- Authentication: 10ms
- Business logic: 30ms
- Database query: 20ms
- Serialization: 5ms
- Network overhead: 10ms
- Total budget: 80ms (p95)

### Capacity Planning
- Calculate requests per second per service from business projections.
- Memory = (concurrent connections * avg request size * buffer factor).
- CPU = (requests/sec * avg processing time) / cores.
- Storage = (daily ingestion rate * retention period * replication factor).

### Load Testing Protocol
1. Baseline: measure current throughput and latency at normal load.
2. Stress: increase load linearly until p99 latency exceeds SLA.
3. Spike: send 5x normal load for 60 seconds, measure recovery time.
4. Soak: run at 80% capacity for 24 hours, watch for memory leaks.

## Security Architecture

- Apply defense in depth: network, application, data, and identity layers.
- Zero trust between services: mutual TLS or signed tokens for all internal calls.
- Secrets management: never in code, config files, or environment variables. Use a vault.
- Input validation at every trust boundary, not just the API gateway.
- Audit logging for all state-changing operations with immutable storage.
- Encryption at rest for all PII. Encryption in transit for all network calls.

## Observability

- Three pillars: structured logs, distributed traces, metrics.
- Every service emits: request count, error rate, latency histogram, saturation metrics.
- Trace context propagation across all service boundaries (W3C TraceContext).
- Dashboards for each service: RED metrics (Rate, Errors, Duration).
- Alerts on symptoms (high error rate), not causes (high CPU).

## Migration Strategy

### Database Migrations
- All migrations must be backward-compatible (online schema changes).
- Never add NOT NULL columns without default values on existing tables.
- Large data migrations: batch with progress tracking, not single transactions.
- Test migration speed with production-sized datasets before deploying.
- Migration rollback plan documented and tested.

### Service Migrations
- Strangler fig pattern for monolith-to-microservice transitions.
- Dual-write during transition, reconcile differences, then cut over.
- Feature flags to control migration progress per customer/tenant.
- Migration metrics: compare old vs new system behavior in parallel.

## Resilience Patterns

### Circuit Breakers
- Configure per downstream dependency: open threshold, half-open test, close threshold.
- Fallback behavior defined for every circuit: cached response, degraded mode, or fast fail.
- Circuit breaker state exposed in health check and dashboard.

### Retry Strategy
- Exponential backoff with jitter for transient failures.
- Maximum retry count (3-5 depending on operation criticality).
- Idempotency tokens for retried write operations.
- Budget-based retries: limit retry traffic to 10% of total traffic.

### Bulkhead Pattern
- Isolate resource pools per dependency: separate thread pools, connection pools.
- Prevent one slow dependency from exhausting resources for all others.
- Size bulkhead based on dependency SLA and traffic distribution.

## Event-Driven Architecture

### Event Design
- Event names: past-tense verbs (OrderPlaced, PaymentReceived, UserCreated).
- Event schema: include event_id, timestamp, version, source, and payload.
- Schema versioning: backward-compatible additions only. Breaking changes get new event type.
- Ordering guarantee: partition by aggregate ID for causal ordering.

### Event Processing
- At-least-once delivery: consumers must be idempotent.
- Dead letter queue for failed events with monitoring and replay capability.
- Consumer lag monitoring: alert when lag exceeds processing SLA.
- Event replay capability for new consumers or bug fixes.

## Technical Debt Management

### Debt Classification
- Reckless/Deliberate: "We don't have time for design" — highest priority to fix.
- Prudent/Deliberate: "Ship now, refactor next sprint" — acceptable with a ticket.
- Prudent/Inadvertent: "Now we know a better approach" — natural evolution.

### Debt Tracking
- Every debt item has: description, impact (latency/reliability/velocity), estimated cost to fix.
- Allocate 20% of sprint capacity to debt reduction. Non-negotiable.
- Prioritize by impact on team velocity, not by age.

<!-- skills: system-design, api-design, scalability-planning, tech-debt-analysis, pattern-selection, database-architecture, performance-engineering, security-architecture, distributed-systems, observability -->
