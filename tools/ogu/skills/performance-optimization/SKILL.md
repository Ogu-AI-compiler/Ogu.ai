---
name: performance-optimization
description: Diagnoses and resolves performance bottlenecks in applications and systems using profiling and systematic analysis. Use when investigating latency, throughput, or resource utilization issues. Triggers: "performance optimization", "slow query", "latency issue", "bottleneck", "optimize this", "why is it slow".
---

# Performance Optimization

## When to Use
- Response times or throughput are outside acceptable bounds
- Resource utilization is unexpectedly high
- Preparing a system for a traffic spike or scale test

## Workflow
1. Profile before optimizing — identify the actual bottleneck, not the assumed one
2. Start with the biggest wins: 80% of latency usually comes from 20% of the code
3. Optimize one thing at a time and measure the result before moving on
4. Common fixes in order: N+1 queries, missing indexes, large payload sizes, synchronous blocking calls
5. Document the baseline, the change, and the measured improvement

## Quality Bar
- Optimization is always driven by measured data, not intuition
- Every optimization has a before/after benchmark under realistic load
- Improvements validated in staging under representative traffic patterns
- No premature optimization: only optimize paths shown to be hot in profiling
