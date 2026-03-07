---
name: capacity-planning
description: Analyzes growth trends and plans infrastructure capacity to meet demand with appropriate headroom. Use when sizing resources, planning for traffic spikes, or evaluating scaling strategies before they become urgent. Triggers: "capacity planning", "right-size", "how much capacity", "scale for load", "resource planning", "growth planning".
---

# Capacity Planning

## When to Use
- Planning infrastructure for a product launch or traffic spike
- Right-sizing over-provisioned or under-provisioned resources
- Evaluating whether current capacity can support projected growth

## Workflow
1. Gather baseline: current traffic, resource utilization, growth rate (30/60/90 day)
2. Project demand: apply growth rate to baseline for target time horizon
3. Model resource requirements: compute, memory, storage, network per demand unit
4. Add safety margin: 20-30% headroom for unexpected spikes
5. Identify bottlenecks: which resource hits limits first as load increases

## Quality Bar
- Plans are based on measured baselines, not guesses
- Cost implications included alongside capacity recommendations
- Plans revisited quarterly or when growth rate changes >25%
- Runbooks exist for scaling operations that may be needed urgently
