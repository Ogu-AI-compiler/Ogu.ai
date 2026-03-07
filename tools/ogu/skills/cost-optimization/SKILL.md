---
name: cost-optimization
description: Identifies and implements cloud cost reduction strategies without impacting reliability or performance. Use when reviewing cloud spend, right-sizing resources, or improving cost efficiency. Triggers: "reduce costs", "cloud costs", "cost optimization", "AWS bill too high", "FinOps", "right-sizing".
---

# Cost Optimization

## When to Use
- Monthly cloud bill is growing faster than revenue
- Resources are provisioned but underutilized
- Preparing the annual cloud budget

## Workflow
1. Analyze current spend by service, team, and environment using cost explorer
2. Identify quick wins: dev/staging environments running 24/7, oversized instances
3. Right-size compute: target 60-70% average CPU utilization for on-demand instances
4. Apply commitment-based discounts (Reserved Instances, Savings Plans) for steady-state workloads
5. Implement tagging strategy so every dollar is attributed to a team and workload

## Quality Bar
- Every optimization is validated against reliability metrics before applying
- Savings are measured before/after with the same traffic baseline
- Tagging compliance is >95% of resources before claiming visibility
- Reserved Instance coverage reviewed quarterly to avoid waste
