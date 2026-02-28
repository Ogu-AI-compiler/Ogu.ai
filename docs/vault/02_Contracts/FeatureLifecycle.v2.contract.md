# Feature Lifecycle v2 Contract

> Formal contract for the feature lifecycle state machine — 12 states, 16 transitions, governance hooks, automatic triggers, invariants, and mission generation.

## Version

2.0

## Purpose

Define the complete lifecycle of a feature from ideation to archive. Every transition has formal governance: who can trigger it, what guards must pass, what policy is evaluated, what side effects fire.

## States

| State | Description | Timeout |
|-------|-------------|---------|
| `draft` | Feature ideated, PRD in progress | — |
| `specced` | PRD + QA complete, ready for architecture | 72h → auto_suspend |
| `planned` | Architecture complete, Plan.json valid | 48h → notify_architect |
| `designed` | Visual design complete | 24h → auto_skip_design |
| `allocated` | Kadima assigned tasks to agents | 4h → reallocate |
| `building` | Active code execution | 168h → auto_suspend |
| `reviewing` | Gates running, compile in progress | 24h → notify_tech_lead |
| `production` | All gates passed, deployed | — |
| `monitoring` | Active production observation | 720h → auto_optimize |
| `optimizing` | Performance tuning | 168h → auto_archive |
| `deprecated` | Marked for removal | 90d → auto_archive |
| `suspended` | Paused by human or system | 30d → auto_archive |
| `archived` | Terminal state — immutable | — |

## Transitions

| ID | From | To | Trigger | Roles | Auto |
|----|------|----|---------|-------|------|
| T01 | draft | specced | spec_complete | pm | No |
| T02 | specced | planned | plan_complete | architect | No |
| T03 | planned | designed | design_complete | designer | No |
| T04 | designed | allocated | kadima_allocated | kadima | Yes |
| T05 | allocated | building | first_task_started | kadima | Yes |
| T06 | building | reviewing | all_tasks_complete | kadima | Yes |
| T07 | reviewing | production | gates_passed | tech-lead | Yes |
| T08 | production | monitoring | observation_started | devops | Yes |
| T09 | monitoring | optimizing | optimization_needed | kadima | Yes |
| T10 | optimizing | monitoring | optimization_complete | tech-lead | No |
| T11 | monitoring | deprecated | deprecate | cto, pm | No |
| T12 | deprecated | archived | archive | devops | Yes |
| T13 | building | suspended | critical_failure | kadima | Yes |
| T14 | reviewing | building | gate_failure_fixable | tech-lead | Yes |
| T15 | * | suspended | human_suspend | cto, tech-lead | No |
| T16 | suspended | allocated | resume | cto, tech-lead | No |

## Mission Generation

| On Transition | Mission Type | Assigned To | Budget |
|---------------|-------------|-------------|--------|
| T09 | optimization | tech-lead | 30% inherit |
| T14 | fix | architect | 50% inherit |
| T13 | investigation | cto | 20% inherit |

## Invariants

1. Every state has invariants that must hold while feature is in that state.
2. Invariants are checked periodically (every 30s by Kadima) and before transitions.
3. Invariant violations are audited but do not auto-transition (except via timeout).
4. Automatic transitions require Kadima polling — no magic background threads.
5. Terminal state (archived) has no outgoing transitions.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3700 | Feature has no state file |
| OGU3701 | No transition from current state via trigger |
| OGU3702 | Role cannot trigger this transition |
| OGU3703 | Guard condition failed |
| OGU3704 | Governance blocked transition |

## Implementation

| Component | Path |
|-----------|------|
| State machine v2 | `tools/ogu/commands/lib/state-machine-v2.mjs` |
| Feature state (v1) | `tools/ogu/commands/feature-state.mjs` |
| Feature state schema | `tools/contracts/schemas/feature-state.mjs` |
