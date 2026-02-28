# Scheduler Contract

> Formal contract for task scheduling: Weighted Fair Queuing, priority classes, starvation prevention, preemption, and quotas.

## Version

1.0

## Purpose

Every task is scheduled via WFQ with 5 priority classes. Scheduling is deterministic — same queue + same state = same decision. Virtual clocks ensure fairness. Starvation prevention via promotion. Preemption for P0/P1 only.

## Algorithm

Weighted Fair Queuing with Priority Classes.

1. Apply starvation prevention (promote long-waiting tasks)
2. Sort by priority class DESC, then virtual clock ASC, then alphabetical (deterministic tiebreaker)
3. Check team quotas, feature quotas, resource availability, feature envelope
4. Advance virtual clock for scheduled feature: `virtualTime[feature] += 1 / weight[feature]`

## Priority Classes

| Class | Range | Preemptible | Max Wait | Guaranteed Slots |
|-------|-------|-------------|----------|-----------------|
| P0-critical | 90-100 | No | 0 | 1 |
| P1-high | 70-89 | No | 60s | 0 |
| P2-normal | 40-69 | Yes | 5min | 0 |
| P3-low | 10-39 | Yes | 10min | 0 |
| P4-background | 0-9 | Yes | unlimited | 0 |

## Fairness

- Each feature has a virtual clock starting at 0
- When a task runs, clock advances by `1 / weight`
- Feature with lowest clock gets scheduled next (proportional fairness)
- Default weight: 1.0
- Weight overrides: `reviewing` state → 1.5, low budget → 0.5, consecutive failures → 0.3
- Tiebreaker: alphabetical slug (deterministic)

## Starvation Prevention

- P3 tasks waiting > 10min: promoted by +10 priority (up to P1)
- P2 tasks waiting > 5min: promoted by +10 priority
- Max 2 promotions per task
- Every promotion is audited

## Preemption

- P0 can preempt P3/P4 tasks
- P1 can preempt P2 tasks running > 10min
- Never preempt: tasks in commit phase, tasks < 30s remaining, tasks holding mutex resources

## Quotas

### Team Quotas
| Team | Max Concurrent Agents | Max Daily Budget |
|------|----------------------|-----------------|
| engineering | 4 | $500 |
| product | 1 | $100 |
| quality | 2 | $200 |

### Feature Quotas
- Max concurrent features building: 5
- Max concurrent features reviewing: 3
- Max total active features: 10

## State Files

| File | Purpose |
|------|---------|
| `.ogu/state/scheduler-state.json` | Task queue + virtual clocks |
| `.ogu/scheduler-policy.json` | Scheduler policy config |

## CLI Commands

| Command | Description |
|---------|-------------|
| `ogu scheduler:status` | Show scheduler state + queue + fairness |
| `ogu scheduler:queue` | Show pending task queue with priorities |
| `ogu scheduler:fairness` | Show virtual clocks + weight per feature |
| `ogu scheduler:simulate --tasks N` | Simulate scheduling N tasks (dry-run) |

## Invariants

1. Scheduling is deterministic — same queue + same state = same decision.
2. Virtual clock ensures fairness — lowest clock always scheduled next.
3. Starvation prevention: no task waits forever (promotion after maxWait).
4. Preemption only for P0/P1 and never during commit phase.
5. Team/feature quotas prevent monopolization.
6. Every scheduling decision is audited.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU5101 | Task already in queue |
| OGU5102 | Team quota exceeded |
| OGU5103 | Feature quota exceeded |
| OGU5104 | Resource unavailable (no preemption possible) |
| OGU5105 | Preemption failed |

## Implementation

| Component | Path |
|-----------|------|
| Scheduler library | `tools/ogu/commands/lib/scheduler.mjs` |
| CLI commands | `tools/ogu/commands/scheduler-cmd.mjs` |
| Kadima integration | `tools/kadima/loops/scheduler.mjs` |
