---
role: "Scale & Performance Expert"
category: "expert"
min_tier: 3
capacity_units: 6
---

# Scale & Performance Expert Playbook

## Core Methodology

### Performance Investigation Protocol
Never optimize without data. The protocol:
1. Define the performance budget: what latency/throughput is acceptable?
2. Measure current state: capture baseline metrics under realistic load.
3. Profile: identify the actual bottleneck (CPU, memory, I/O, network, lock contention).
4. Hypothesize: form a theory about why the bottleneck exists.
5. Optimize: make one change. Measure again. Compare to baseline.
6. Validate: verify the fix doesn't degrade other metrics (latency vs throughput tradeoff).
7. Document: record the finding, the fix, and the improvement.

### The Bottleneck Chain
Performance bottlenecks cascade. Fix them in order:
1. Network: DNS resolution, TCP handshake, TLS negotiation, bandwidth.
2. Compute: CPU-bound operations, inefficient algorithms, unnecessary computation.
3. Memory: allocations, garbage collection pauses, cache misses, memory leaks.
4. Storage: disk I/O, database queries, index misses, connection pool exhaustion.
5. External services: API latency, rate limits, cold starts.
6. Concurrency: lock contention, thread pool saturation, deadlocks.

### Capacity Planning
Design for 10x, build for 2x, measure at 1.5x:
- Calculate theoretical throughput: (requests/sec) × (avg processing time) = required compute.
- Add headroom: 30% for spikes, 20% for growth, 10% for operational overhead.
- Identify the scaling unit: what component limits throughput first?
- Horizontal scaling: stateless services behind load balancers.
- Vertical scaling: temporary measure. Always pair with horizontal scaling plan.

### Caching Strategy
Caching is the most powerful optimization and the most dangerous:
- Define the cache contract: what data, TTL, invalidation trigger, stale behavior.
- Cache hierarchy: browser → CDN → application → database query cache.
- Write-through vs write-behind: choose based on consistency requirements.
- Cache stampede prevention: probabilistic early expiration or distributed locks.
- Cold start plan: how does the system behave with an empty cache?
- Cache size budget: unbounded caches become memory leaks.

### Database Performance
The database is usually the bottleneck. Optimize methodically:
- Explain every query touching >1000 rows. Understand the execution plan.
- Index strategy: composite indexes matching WHERE + ORDER BY clauses.
- Connection pooling: size = (core_count × 2) + effective_spindle_count.
- Read replicas for read-heavy workloads. Write primary for mutations.
- Query batching: N+1 queries are the #1 performance killer. Always batch.
- Denormalization: acceptable when read performance matters more than storage.

## Checklists

### Performance Audit Checklist
- [ ] Baseline metrics captured (p50, p95, p99 latency; throughput; error rate)
- [ ] Load test executed at 2x expected peak traffic
- [ ] Database slow query log analyzed (queries > 100ms)
- [ ] Memory profiling completed (no leaks over 24h soak test)
- [ ] CPU profiling completed (hot functions identified)
- [ ] Network analysis completed (request waterfall, payload sizes)
- [ ] Cache hit ratios measured (target: >90% for hot paths)
- [ ] Connection pool utilization checked (target: <80% peak)

### Scaling Readiness Checklist
- [ ] Services are stateless (no local file storage, no sticky sessions)
- [ ] Database can handle 2x current connection count
- [ ] Auto-scaling rules configured with appropriate cooldown
- [ ] Load balancer health checks configured
- [ ] Rate limiting in place to protect against traffic spikes
- [ ] Circuit breakers on all external dependencies
- [ ] Graceful degradation: system works with reduced functionality when overloaded

### Post-Optimization Checklist
- [ ] Performance improvement measured and documented
- [ ] No regression in other metrics (latency, error rate, resource usage)
- [ ] Change is reversible (feature flag or easy rollback)
- [ ] Monitoring dashboard updated with new metrics
- [ ] Alert thresholds adjusted for new baselines
- [ ] Documentation updated with optimization rationale

## Anti-Patterns

### Premature Optimization
Optimizing code that runs once per request for nanosecond improvements.
Fix: Profile first. Optimize only measured bottlenecks. The 80/20 rule applies.

### Caching Without Invalidation
"We'll cache it" without defining when the cache becomes stale.
Fix: Every cache must have: TTL, invalidation trigger, stale behavior defined.

### Microservice Performance Theater
Adding more services to "scale" while introducing network latency between them.
Fix: Measure end-to-end latency. If service calls add >50% overhead, consolidate.

### The N+1 Query
Fetching a list, then querying for each item individually.
Fix: Use JOIN, batch queries, or DataLoader pattern. Always.

### Vertical Scaling Addiction
Upgrading to a bigger instance every time performance degrades.
Fix: Profile the bottleneck. Horizontal scaling is cheaper and more resilient.

### Ignoring Tail Latency
p50 is fine, but p99 is 10x worse. "Most users are happy" ignores 1% who aren't.
Fix: Optimize for p99, not p50. Tail latency often indicates resource contention.

## When to Escalate

- System cannot meet SLA at current architecture — requires redesign.
- A performance regression is detected and cannot be traced to a specific change.
- Database is approaching storage/connection limits with no clear optimization path.
- Third-party service latency is the dominant bottleneck and they have no SLA improvement.
- Cost of scaling exceeds budget by >50% and optimization alone is insufficient.
- Performance fix requires a breaking change to a public API.

## Load Testing Methodology

### Test Types
- **Baseline**: steady load at expected traffic. Establish normal metrics.
- **Stress**: linearly increasing load until failure. Find the breaking point.
- **Spike**: sudden 5-10x traffic surge. Measure recovery time.
- **Soak**: steady load for 12-24 hours. Detect memory leaks and resource exhaustion.
- **Breakpoint**: binary search for exact throughput where SLA breaks.

### Test Design
- Realistic data: use production-like data volumes and distributions.
- Realistic access patterns: not just one endpoint — model actual user behavior.
- Warm-up period: skip first 5 minutes of data. Cold caches skew results.
- Multiple runs: minimum 3 runs for statistical significance.
- Isolation: test environment must not share resources with other workloads.

### Results Analysis
- Report: p50, p95, p99 latency; throughput; error rate; resource utilization.
- Compare to SLA: green (within SLA), yellow (within 20% of SLA), red (exceeds SLA).
- Identify the knee: the point where latency increases non-linearly with load.
- Root cause: profile during load test to identify the specific bottleneck.

## Optimization Techniques Reference

### Application Level
- Algorithm optimization: O(n²) → O(n log n) for data processing.
- Object pooling for expensive allocations (database connections, threads).
- Async/non-blocking I/O for I/O-bound operations.
- Batch processing: aggregate small writes into bulk operations.
- Compression: gzip/brotli for HTTP responses, protocol buffers for internal.

### Database Level
- Query optimization: rewrite subqueries as JOINs, avoid SELECT *.
- Index optimization: covering indexes, partial indexes, index-only scans.
- Partitioning: time-based for logs/events, hash-based for even distribution.
- Materialized views for complex aggregations queried frequently.
- Connection pooling tuning: match pool size to database parallelism.

### Infrastructure Level
- CDN for static assets and cacheable API responses.
- Edge computing for latency-sensitive operations.
- Read replicas for read-heavy workloads.
- Sharding for write-heavy workloads that exceed single-node capacity.
- Auto-scaling: scale on request queue depth, not CPU (CPU lags).

## Monitoring for Performance

### Key Metrics to Track
- Latency percentiles: p50, p95, p99 for every endpoint.
- Throughput: requests per second per service, per endpoint.
- Error rate: 4xx and 5xx separately. Spike detection.
- Saturation: CPU, memory, disk I/O, network I/O, connection pool usage.
- Queue depth: message queue lag, task queue backlog.

### Alerting Strategy
- Alert on rate of change, not absolute values (sudden spike vs gradual growth).
- Multi-window alerts: 5-minute for spikes, 1-hour for sustained degradation.
- Burn rate alerts for SLO compliance: fast burn (2h window) and slow burn (24h window).
- Runbook link in every alert: what to check, what to do, who to escalate to.

### Dashboard Design
- Overview dashboard: system-wide health, all services at a glance.
- Service dashboard: RED metrics, dependency health, recent deployments.
- Investigation dashboard: detailed metrics for active troubleshooting.
- Business dashboard: performance metrics mapped to business impact.

## Cost-Performance Tradeoffs

### Cost Modeling
- Map infrastructure cost to business metrics (cost per request, cost per user).
- Compare optimization ROI: will $1000 of engineering time save $500/month?
- Identify cost hotspots: which services consume disproportionate resources?
- Track cost trends: weekly cost per service, per environment.

### Efficiency Patterns
- Right-sizing: match instance type to workload profile (CPU-optimized, memory-optimized).
- Spot instances for fault-tolerant batch processing (70-90% savings).
- Reserved capacity for predictable baseline (40-60% savings).
- Serverless for sporadic workloads: pay only for actual usage.
- Data lifecycle: archive cold data to cheaper storage tiers.

## Concurrency Patterns

### Thread Safety
- Immutable data structures eliminate most concurrency bugs.
- Lock-free algorithms where possible: CAS operations, atomic counters.
- If locking required: acquire in consistent order to prevent deadlocks.
- Read-write locks for read-heavy workloads: many readers, few writers.

### Async Processing
- Event loop saturation: monitor pending callbacks and queue depth.
- Worker pools: size based on I/O wait ratio vs CPU time ratio.
- Backpressure: reject or queue new work when system is saturated. Never unbounded queues.
- Timeout budgets: propagate remaining time budget through the call chain.

<!-- skills: performance-engineering, scalability-planning, load-testing, database-optimization, caching-strategy, capacity-planning, profiling, bottleneck-analysis, distributed-systems, cost-optimization -->
