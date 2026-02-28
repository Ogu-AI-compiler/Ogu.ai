# Failure Domains Contract

> Formal contract for failure domains, circuit breakers, degraded modes, and system halt.

## Version

1.0

## Purpose

Every system failure is mapped to a failure domain with detection, circuit breaker, and failover strategy. Audit failure triggers system halt. Filesystem failure triggers read-only mode. Provider failure triggers automatic failover.

## Failure Domains

| Domain | Name | Halt on Failure | Degraded Mode | Failover Strategy |
|--------|------|-----------------|---------------|-------------------|
| FD-PROVIDER | Model Provider | No | single_provider | next_provider_same_capability |
| FD-FILESYSTEM | Local Filesystem | Yes | read_only | emergency_read_only_mode |
| FD-AUDIT | Audit Trail | Yes | audit_emergency | halt_system |
| FD-BUDGET | Budget System | No | budget_frozen | reconstruct_from_audit |
| FD-SCHEDULER | Scheduler Engine | No | — | rebuild_from_feature_states |

## Circuit Breaker States

```
closed → (threshold failures) → open → (cooldown elapsed) → half-open → (probe success) → closed
                                                              ↓ (probe failure)
                                                             open
```

## Circuit Breaker Config per Domain

| Domain | Threshold | Window | Cooldown |
|--------|-----------|--------|----------|
| FD-PROVIDER | 3 | 60s | 120s |
| FD-FILESYSTEM | 1 | 10s | 60s |
| FD-AUDIT | — | — | — (HALT) |
| FD-BUDGET | 2 | 30s | 60s |
| FD-SCHEDULER | 2 | 30s | 60s |

## Provider Failover Chain

```
anthropic → openai → local
```

## Global Kill Switch

- **Trigger:** `ogu system:halt` OR automatic on FD-AUDIT / FD-FILESYSTEM critical failure
- **Actions:** Stop scheduling, checkpoint tasks, release resources, halt sessions, emergency audit
- **Preserves:** All .ogu/ state, worktrees, snapshots
- **Recovery:** `ogu system:resume` requires actor identification + consistency check pass

## Degraded Modes

| Mode | Description |
|------|-------------|
| read_only | No writes, audit/status viewable, no new tasks |
| single_provider | Route through surviving provider |
| budget_frozen | Tasks continue without budget tracking |
| audit_emergency | Emergency backup audit to `.ogu/audit-emergency/` |

## CLI Commands

| Command | Description |
|---------|-------------|
| `ogu system:halt --reason "..."` | Emergency halt |
| `ogu system:resume --actor <name>` | Resume (requires consistency check) |
| `ogu system:health` | Show all failure domains + circuit breakers |
| `ogu circuit:status` | Circuit breaker status per domain |
| `ogu circuit:reset <domainId>` | Manually close a circuit breaker |
| `ogu provider:health` | Provider health dashboard |
| `ogu provider:failover --test` | Test failover chain (dry-run) |

## Invariants

1. Every failure is mapped to exactly one failure domain.
2. Circuit breaker state machine: closed → open → half-open → closed.
3. FD-AUDIT failure always triggers system halt.
4. System resume requires consistency check pass.
5. Provider failover follows defined chain order.
6. Every circuit trip, halt, and resume is audited.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU6101 | Circuit breaker tripped |
| OGU6102 | System halt triggered |
| OGU6103 | Resume consistency check failed |
| OGU6104 | Unknown failure domain |
| OGU6105 | Failover chain exhausted |

## State Files

| File | Purpose |
|------|---------|
| `.ogu/state/circuit-breakers.json` | Circuit breaker state per domain |
| `.ogu/state/halt-log.json` | Halt/resume history |
| `.ogu/STATE.json` | Halt flag + halt record |

## Implementation

| Component | Path |
|-----------|------|
| Circuit breaker library | `tools/ogu/commands/lib/circuit-breaker.mjs` |
| System halt library | `tools/ogu/commands/lib/system-halt.mjs` |
| CLI commands | `tools/ogu/commands/failure-cmd.mjs` |
| Failure domain manager | `tools/ogu/commands/lib/failure-domain-manager.mjs` |
| Failure strategy | `tools/ogu/commands/lib/failure-strategy.mjs` |
| Company freeze | `tools/ogu/commands/lib/company-freeze.mjs` |
