# Deterministic Mode Contract

> Formal contract for deterministic execution mode — full lockdown guaranteeing same inputs produce same outputs within tolerance.

## Version

1.0

## Purpose

Deterministic mode freezes all mutable configuration so that a feature build is fully reproducible. When enabled, policies, OrgSpec, model routing, overrides, budget limits, and auto-transitions are all locked. Any non-determinism halts the task and escalates.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/STATE.json` | Contains `deterministic` block with mode state |
| `.ogu/snapshots/{entry-snapshot}.json` | Company snapshot at mode entry |
| `.ogu/snapshots/{exit-snapshot}.json` | Company snapshot at mode exit |

## Components

| Component | Path |
|-----------|------|
| Deterministic mode engine | `tools/ogu/commands/lib/deterministic-mode.mjs` |
| Company freeze | `tools/ogu/commands/lib/company-freeze.mjs` |
| Determinism tolerance | `tools/ogu/commands/lib/determinism-tolerance.mjs` |

## Activation

| Method | Command / Call |
|--------|----------------|
| CLI | `ogu deterministic:enable [--seed N] [--actor <name>]` |
| Programmatic | `enableDeterministic({ seed, actor })` |
| Per-feature | Set `feature.deterministic: true` in Plan.json |

## Scope

| Scope | Description |
|-------|-------------|
| Global | All features and tasks execute deterministically |
| Per-feature | Only the specified feature runs in deterministic mode |

## Locked Behaviors

| System | When Deterministic Mode is ON |
|--------|-------------------------------|
| Policies | Frozen — no rule changes allowed |
| OrgSpec | Frozen — no role additions/removals |
| Model routing | Pinned — no model escalation or fallback |
| Overrides | Blocked — no human overrides accepted |
| Budget limits | Frozen — no limit adjustments |
| Learning signals | Recorded but NOT applied |
| Auto-transitions | Disabled — no automatic phase transitions |
| Seed | Optional fixed seed for any randomized decisions |

## Guarantees

1. **Reproducibility**: Same inputs (plan, policy, orgSpec, model responses) produce the same outputs.
2. **Tolerance**: Minor floating-point or timestamp differences are accepted within configured tolerance (via `determinism-tolerance.mjs`).
3. **Entry/exit snapshots**: Full company snapshot captured at enable and disable for diff comparison.
4. **Non-determinism detection**: If any locked system changes during execution, the task halts with escalation.

## Invariants

1. Deterministic mode can only be enabled by an explicit actor (no auto-enable).
2. Deterministic mode can only be disabled by an explicit actor (no timeout-based auto-disable).
3. All state changes during deterministic mode are audited.
4. Entry snapshot MUST be captured before any task executes.
5. Exit snapshot MUST be captured before mode is disabled.
6. A feature in deterministic mode cannot be switched to non-deterministic mid-build.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ogu deterministic:enable` | Enter deterministic mode (full lockdown) |
| `ogu deterministic:disable` | Exit deterministic mode |
| `ogu deterministic:status` | Show current mode state and locks |

## Audit

All deterministic mode state changes are emitted to the audit trail:

| Event | When |
|-------|------|
| `deterministic.enabled` | Mode activated with actor, seed, locks |
| `deterministic.disabled` | Mode deactivated with actor, entry/exit snapshots |
| `deterministic.violation` | Non-determinism detected during execution |
| `deterministic.halted` | Task halted due to violation |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU-DET-001 | Deterministic mode already active |
| OGU-DET-002 | Deterministic mode not active (cannot disable) |
| OGU-DET-003 | Non-determinism detected — task halted |
| OGU-DET-004 | Locked system modified during deterministic mode |
| OGU-DET-005 | Snapshot capture failed at entry/exit |
