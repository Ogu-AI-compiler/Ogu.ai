---
name: experiment-design
description: Designs rigorous experiments with proper controls, success metrics, and sample sizes to reliably test hypotheses. Use when planning A/B tests, feature launches, or any hypothesis-driven product change. Triggers: "design an experiment", "A/B test plan", "hypothesis testing", "experiment setup", "how do we test this".
---

# Experiment Design

## When to Use
- Planning a product change that needs to be validated before full rollout
- Setting up an A/B test for a new feature or UX change
- Evaluating the impact of a process or operational change

## Workflow
1. Define the hypothesis: "If we do X, then metric Y will change by Z%"
2. Choose primary metric and guardrail metrics (must not degrade)
3. Calculate required sample size for desired power (80%) and alpha (0.05)
4. Define the control (A) and treatment (B) clearly — one variable at a time
5. Pre-register the analysis plan before data collection begins

## Quality Bar
- Experiment runs long enough to capture full weekly seasonal patterns
- Sample is randomized and representative of the target population
- Analysis plan locked before peeking at results (no p-hacking)
- Decision criteria defined upfront: what results trigger rollout vs rollback
