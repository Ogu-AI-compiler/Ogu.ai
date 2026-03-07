---
name: consensus-building
description: Consensus building expertise for building reliable distributed systems with strong consistency guarantees. Use when designing consensus building, handling distributed transactions, or ensuring consistency across services. Triggers: "consensus building", "design consensus-building", "implement consensus-building", "distributed consensus-building".
---

# Consensus building

## When to Use

Activate this skill when:
- Working on consensus building tasks
- Reviewing or improving existing consensus building implementations
- Troubleshooting issues related to consensus building
- Setting up or configuring consensus building from scratch

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
