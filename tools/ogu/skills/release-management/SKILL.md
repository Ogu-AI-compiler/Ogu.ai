---
name: release-management
description: Coordinates and executes software releases with change management, rollout plans, and rollback strategies. Use when planning releases, managing feature flags, or coordinating cross-team launches. Triggers: "release management", "deploy to production", "release plan", "rollout strategy", "launch", "go live".
---

# Release Management

## When to Use
- Coordinating a major release across multiple teams
- Planning a gradual rollout with feature flags
- Preparing a release with a rollback plan for high-risk changes

## Workflow
1. Write release plan: what is changing, who is affected, rollback steps
2. Define go/no-go criteria: what metrics or test results must pass before releasing
3. Use feature flags for high-risk changes: enable for canary → 10% → 50% → 100%
4. Monitor key metrics for 1-2 hours after each rollout stage
5. Have a rollback plan ready: tested, documented, executable in < 15 minutes

## Quality Bar
- Every release has a documented rollback procedure tested in staging
- Feature flags are cleaned up within 2 sprints of full rollout
- Release notes written for both users and internal teams
- Post-release monitoring shows no regression in error rate or latency
