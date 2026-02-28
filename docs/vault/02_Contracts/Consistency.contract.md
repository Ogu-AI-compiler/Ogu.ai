# Consistency Contract

> Formal contract for transaction boundaries, source-of-truth hierarchy, idempotency, and reconciliation.

## Version

1.0

## Purpose

Every state-changing operation in Ogu follows the SAGA transaction pattern with formal consistency guarantees. Rollback = compensating events (never delete). Idempotency ensures safe retries. Reconciliation detects and fixes cross-layer drift.

## Source of Truth Hierarchy

| Rank | Layer | Path | Property | Rule |
|------|-------|------|----------|------|
| 1 | Audit Trail | `.ogu/audit/` | append-only, immutable | If audit says it happened, it happened. Audit is never rolled back. |
| 2 | Feature State Machine | `.ogu/state/features/` | single-writer | Feature state is authoritative lifecycle position. |
| 3 | Execution Snapshots | `.ogu/snapshots/` | immutable after capture | Snapshots are evidence, not state drivers. |
| 4 | Budget State | `.ogu/budget/` | eventually consistent | Budget reconstructible from audit events. |
| 5 | Resource Governor | `.ogu/locks/` | ephemeral | Resource state is volatile, reconstructible. |
| 6 | Agent Sessions | `.ogu/agents/sessions/` | ephemeral, time-bounded | Sessions expire. On conflict, kill and re-create. |

**Conflict Resolution:** Higher rank wins. If rank 4 (Budget) says $12 spent but rank 1 (Audit) shows $15, Budget is corrected to $15.

## Transaction Phases

| Phase | Name | Actions | Rollback |
|-------|------|---------|----------|
| 1 | prepare | Validate envelope, check budget, acquire resources | Release slot, log prepare_failed |
| 2 | execute | Run agent task (model call + tool calls) | Quarantine outputs, log execute_failed |
| 3 | commit | Audit → Budget → Allocation → Snapshot → Release → Session | See commit failure handling |

**Commit Order:** audit → budget → allocation → snapshot → resource → session

**Commit Failure Handling:**

| Step | If Fails |
|------|----------|
| Audit fails | CRITICAL: halt system (filesystem broken) |
| Budget fails | Mark DIRTY, reconcile later from audit |
| Allocation fails | Retry 3x, then mark ORPHANED in audit |
| Snapshot fails | Log warning (evidence, not state) |
| Resource fails | Force-release on next poll cycle |
| Session fails | Auto-expire via TTL |

## Idempotency

- Key format: `sha256(taskId + featureSlug + attempt)[0:16]`
- Storage: `.ogu/idempotency/{key}.json`
- TTL: 24 hours (garbage collected after)
- Re-executing with same key + status=committed = no-op (cached result)

## Reconciliation Checks

| Check | Description | Fix |
|-------|-------------|-----|
| budget_vs_audit | Sum audit budget events → compare to budget.json | Overwrite budget with audit-derived values |
| sessions_vs_resources | No resource slot without active session | Release orphaned slots |
| orphaned_transactions | Transactions in limbo > 1h | Auto-rollback |
| budget_dirty_flags | Dirty budget flags from failed commits | Mark reconciled |

## State Files

| File | Purpose |
|------|---------|
| `.ogu/transactions/{txId}.json` | Transaction records |
| `.ogu/idempotency/{key}.json` | Idempotency keys |
| `.ogu/budget/dirty-flags.json` | Budget dirty markers |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU5001 | Feature envelope check failed during prepare |
| OGU5002 | Transaction already committed (idempotency hit) |
| OGU5003 | Transaction rolled back |
| OGU5004 | Orphaned transaction detected |
| OGU5005 | Consistency check failed |

## Invariants

1. Audit is append-only. No deletes. No updates. Only appends.
2. Budget corrections via compensating entries, not overwrites.
3. Feature state reverts via explicit transition (building→allocated on failure).
4. Resource slots released on any failure path.
5. Every operation has an idempotency key. Same key = same result.

## Implementation

| Component | Path |
|-----------|------|
| Transaction runtime | `tools/ogu/commands/lib/transaction.mjs` |
