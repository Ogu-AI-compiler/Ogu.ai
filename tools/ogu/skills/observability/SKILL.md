---
name: observability
description: Implements distributed tracing, structured logging, and metrics for end-to-end system visibility. Use when diagnosing production issues across service boundaries or improving system transparency. Triggers: "observability", "distributed tracing", "add tracing", "OpenTelemetry", "structured logging".
---

# Observability

## When to Use
- A production issue spans multiple services and needs tracing
- Logs are unstructured and hard to query or correlate
- New service needs full observability from day one

## Workflow
1. Implement the three pillars: metrics, logs, and traces
2. Use OpenTelemetry for instrumentation (vendor-neutral)
3. Add correlation IDs propagated across all service calls
4. Structure all logs as JSON with consistent fields (timestamp, level, service, trace_id)
5. Create trace visualizations for the most critical user flows

## Quality Bar
- A single request can be traced end-to-end across all services
- Logs are queryable and aggregated in a central platform
- P99 latency is visible per service, not just end-to-end
- Sampling strategy retains 100% of error traces
