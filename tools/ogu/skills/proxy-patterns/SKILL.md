---
name: proxy-patterns
description: Proxy patterns expertise for building reliable distributed systems with strong consistency guarantees. Use when designing proxy patterns, handling distributed transactions, or ensuring consistency across services. Triggers: "proxy patterns", "design proxy-patterns", "implement proxy-patterns", "distributed proxy-patterns".
---

# Proxy patterns

## When to Use

Activate this skill when:
- Working on proxy patterns tasks
- Reviewing or improving existing proxy patterns implementations
- Troubleshooting issues related to proxy patterns
- Setting up or configuring proxy patterns from scratch

## Workflow

1. Define consistency, availability, and partition tolerance requirements (CAP trade-offs)
2. Select appropriate distributed patterns (saga, event sourcing, CQRS, etc.)
3. Design failure modes, recovery strategies, and compensating transactions
4. Implement with idempotency guarantees for all operations
5. Add distributed tracing across service boundaries
6. Test failure scenarios with chaos engineering
7. Document system behavior under network partitions
8. Validate against consistency and durability requirements
9. Set up observability for distributed flows (traces, metrics, logs)

## Quality Bar

- Idempotency guaranteed for all state mutations
- Failure modes documented and handled
- Distributed tracing instrumented end-to-end
- Consistency model clearly documented
- Chaos tests cover key failure scenarios

## Related Skills

See complementary skills in the same domain for additional workflows.
