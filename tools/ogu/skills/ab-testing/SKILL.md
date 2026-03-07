---
name: ab-testing
description: Implements and analyzes A/B tests for features, UX changes, and product decisions. Use when running controlled experiments, interpreting test results, or optimizing conversion funnels. Triggers: "A/B test", "split test", "run an experiment", "test this variant", "feature experiment".
---

# A/B Testing

## When to Use
- Validating a product change before full rollout
- Optimizing conversion rates for a landing page or funnel step
- Testing multiple variants of copy, UI, or algorithm

## Workflow
1. Define hypothesis, primary metric, and guardrail metrics
2. Set up feature flagging to randomly assign users to A or B
3. Calculate required sample size; don't stop early based on preliminary results
4. Ensure consistent assignment: same user always sees the same variant
5. Analyze with appropriate statistical test; check for novelty effect

## Quality Bar
- Experiment runs for at least one full business cycle (usually 1-2 weeks)
- User assignment is random and stratified if needed
- Results include effect size and confidence intervals
- Winning variant deployed promptly; losing variants cleaned up from codebase
