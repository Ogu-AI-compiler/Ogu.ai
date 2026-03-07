---
name: distributed-systems
description: Designs and implements distributed architectures with explicit handling of consistency, availability, and partition tolerance trade-offs. Use when building microservices, event-driven systems, or any system spanning multiple nodes. Triggers: "distributed systems", "CAP theorem", "consistency vs availability", "microservices design", "distributed architecture".
---

# Distributed Systems

## When to Use
- Designing a system that spans multiple services or nodes
- Evaluating consistency vs availability trade-offs for a use case
- Debugging distributed failures like split-brain or data inconsistency

## Workflow
1. Establish consistency requirements: is eventual consistency acceptable or must it be strong
2. Design for failure: assume any node or network can fail at any time
3. Use idempotent operations so retries are safe
4. Implement distributed tracing from day one — it's nearly impossible to add later
5. Document the CAP/PACELC trade-offs chosen and why

## Quality Bar
- All state mutations are idempotent (safe to retry without side effects)
- Failure scenarios are documented and tested with chaos engineering
- No distributed transactions if avoidable — use sagas or outbox pattern instead
- Consistency guarantees documented and communicated to API consumers
