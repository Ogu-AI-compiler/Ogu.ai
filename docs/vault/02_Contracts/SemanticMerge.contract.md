# Semantic Merge Contract

> Formal contract for the AST-aware merge system — concurrent agent file writes, lock acquisition, conflict resolution, and deterministic merge ordering.

## Version

1.0

## Purpose

When multiple agents write to the same file concurrently, Ogu resolves conflicts at the AST block level rather than line level. The semantic merge system guarantees no data loss, deterministic merge order, and a full audit trail for every merge decision.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/locks/semantic/{filePath-hash}.json` | Per-symbol lock records |
| `.ogu/merge/pending/{mergeId}.json` | Pending merge operations |
| `.ogu/merge/history/{mergeId}.json` | Completed merge audit trail |

## Components

| Component | Path |
|-----------|------|
| AST merge engine | `tools/ogu/commands/lib/ast-merge.mjs` |
| Semantic mutex | `tools/ogu/commands/lib/semantic-mutex.mjs` |

## Merge Strategy Hierarchy

| Priority | Strategy | Description |
|----------|----------|-------------|
| 1 | AST-level merge | Blocks parsed into functions/classes/exports. Non-overlapping block changes merge cleanly. |
| 2 | Line-level merge | If AST parsing fails (unknown language), falls back to 3-way line diff. |
| 3 | Manual resolution | If both agents modified the same block, escalate to human or senior agent. |

## Lock Acquisition Protocol

1. **Before write**: Agent MUST acquire a semantic lock on the target symbols via `acquireSymbolLock()`.
2. **Lock granularity**: Locks are per-symbol (function, class, export), not per-file.
3. **Lock timeout**: Locks expire after 5 minutes if not released (prevents deadlocks).
4. **After write**: Agent MUST release the lock via `releaseSymbolLock()`.
5. **Lock contention**: If a symbol is already locked, the requesting agent receives `OGU-MERGE-002` and must wait or choose a different symbol.

## Conflict Detection

| Scenario | Result |
|----------|--------|
| Agent A modifies `functionX`, Agent B modifies `functionY` (same file) | No conflict — AST merge succeeds |
| Agent A modifies `functionX`, Agent B modifies `functionX` | Conflict — escalated per merge strategy |
| Agent A adds new function, Agent B adds new function | No conflict — both appended |
| Agent A deletes `functionX`, Agent B modifies `functionX` | Conflict — delete vs modify escalated |

## Merge Order Determinism

- Merges are ordered by lock acquisition timestamp (earliest first).
- Ties broken by agent ID lexicographic order.
- The merge result is always identical regardless of the order agents finish.

## Invariants

1. No data loss: every agent's changes are either merged or preserved in the conflict record.
2. Deterministic merge order: same inputs always produce the same merged output.
3. Audit trail: every merge operation is logged with before/after hashes, agent IDs, and strategy used.
4. Lock before write: any write without a prior lock acquisition is rejected.
5. Blocked paths override: sandbox-blocked paths cannot be merged, only read.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ogu merge:preview <file>` | Preview merge results for conflicting files |
| `ogu merge:ast <file>` | Run AST-level merge on conflicting files |
| `ogu merge:conflicts` | List all current merge conflicts |
| `ogu semantic:lock:acquire` | Acquire a semantic lock on a resource |
| `ogu semantic:lock:release` | Release a semantic lock |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU-MERGE-001 | AST parse failed — falling back to line-level merge |
| OGU-MERGE-002 | Symbol lock contention — another agent holds the lock |
| OGU-MERGE-003 | Merge conflict — same block modified by multiple agents |
| OGU-MERGE-004 | Merge audit write failed — filesystem error |
| OGU-MERGE-005 | Lock expired — agent held lock beyond timeout |
