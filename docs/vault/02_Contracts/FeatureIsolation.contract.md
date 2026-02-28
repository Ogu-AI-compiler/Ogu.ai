# Feature Isolation Contract

> Formal contract for per-feature isolation — budget, concurrency, blast radius, and failure containment.

## Version

1.0

## Purpose

Enforce isolation boundaries at feature level. Prevent one feature from consuming another's budget, slots, or file scope. Contain failures within feature boundaries.

## State Files

| File | Purpose |
|------|---------|
| `docs/vault/04_Features/{slug}/envelope.json` | Per-feature isolation envelope |

## Feature Envelope Schema

| Section | Contents |
|---------|----------|
| `budget` | maxTotalCost, maxCostPerTask, dailyLimit, spent, remaining, alerts |
| `concurrency` | maxParallelAgents, maxParallelModelCalls, maxParallelBuilds, maxWorktrees |
| `blastRadius` | maxFiles, allowedPaths, blockedPaths, maxProcesses, maxMemoryMb, networkEgress |
| `failureContainment` | maxConsecutiveFailures, maxTotalFailures, onConsecutiveFailure, onTotalFailure |
| `policyOverrides` | Per-feature policy rule overrides |

## Enforcement Flow

1. **Feature envelope checked BEFORE resource governor**
2. Budget check → concurrency check → blast radius check → failure check
3. Any violation = task blocked with OGU38xx error
4. Envelope alert thresholds fire audit events

## Invariants

1. Feature cannot exceed its envelope even if global resources are available.
2. Blast radius is enforced at file level — agents cannot touch files outside scope.
3. Failure in one feature NEVER propagates to another.
4. Blocked paths ALWAYS override allowed paths.
5. Consecutive failure reset on success.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3801 | Feature budget exceeded |
| OGU3802 | Task cost exceeds per-task limit |
| OGU3803 | Feature concurrency limit reached |
| OGU3804 | File outside feature's allowed paths |
| OGU3805 | File in feature's blocked paths |
| OGU3806 | Consecutive failure limit hit |
| OGU3807 | Too many files touched |
| OGU3808 | Total failure limit hit |

## Implementation

| Component | Path |
|-----------|------|
| Feature isolation engine | `tools/ogu/commands/lib/feature-isolation.mjs` |
