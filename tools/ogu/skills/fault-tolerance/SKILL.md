---
name: fault-tolerance
description: Fault tolerance expertise for building reliable distributed systems with strong consistency guarantees. Use when designing fault tolerance, handling distributed transactions, or ensuring consistency across services. Triggers: "fault tolerance", "design fault-tolerance", "implement fault-tolerance", "distributed fault-tolerance".
---

# Fault tolerance

## When to Use

Activate this skill when:
- Working on fault tolerance tasks
- Reviewing or improving existing fault tolerance implementations
- Troubleshooting issues related to fault tolerance
- Setting up or configuring fault tolerance from scratch

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
