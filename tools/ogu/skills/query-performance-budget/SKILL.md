---
name: query-performance-budget
description: Compiler skill for the query-performance-budget compiler. Activates when producing query-performance-artifact.json. Gates: QPB001–QPB006. No upstream dependency.
---

# query-performance-budget — Compiler Skill

## What This Compiler Does

Compiles the database query performance budget — workload classes with statement timeouts, max transaction duration, replica timeout constraints, API SLO alignment, and vague-timeout detection. Enforces: every workload has a concrete `statement_timeout`, `max_transaction_duration` is finite and parseable, replica timeouts are tighter than primary, OLTP p99 latency fits within the API SLO budget, and no timeout field uses vague values like `"unlimited"` or `"high"`.

**Upstream dependency:** none
**Output artifact:** `query-performance-artifact.json`
**IR identifier:** `QUERY_PERF_BUDGET:{project}`

---

## Spec Shape

```json
{
  "workloads": {
    "oltp": {
      "statement_timeout": "5s",
      "lock_timeout": "2s",
      "p99_latency_ms": 50
    },
    "reports": {
      "statement_timeout": "30s",
      "p99_latency_ms": 5000
    },
    "background": {
      "statement_timeout": "5m",
      "p99_latency_ms": 60000
    },
    "replica_read": {
      "statement_timeout": "30s",
      "is_replica": true,
      "p99_latency_ms": 5000
    }
  },
  "max_transaction_duration": "30s",
  "api_slo_ms": 200
}
```

Required fields:
- `workloads` — object with at least one workload class
- `max_transaction_duration` — concrete duration string (e.g., `"30s"`, `"5m"`)

Valid duration formats: `NNms`, `NNs`, `NNm`/`NNmin`, `NNh`

---

## Gates

### QPB001 — spec-valid
Reads `query-performance-budget.json`. Required: `workloads` (non-empty object), `max_transaction_duration`.

Hard-fails if `query-performance-budget.json` is missing.

### QPB002 — workload-classes
Each workload class must declare `statement_timeout` as a concrete, parseable duration string. Vague values (`"high"`, `"acceptable"`, `"unlimited"`) and invalid formats are rejected.

BAD:
```json
{ "workloads": { "oltp": { "statement_timeout": "fast" } } }
// vague
```
```json
{ "workloads": { "oltp": { "statement_timeout": "5 seconds" } } }
// invalid format — use "5s"
```
GOOD:
```json
{ "workloads": { "oltp": { "statement_timeout": "5s", "p99_latency_ms": 50 } } }
```

### QPB003 — max-transaction-duration
`max_transaction_duration` must be a concrete, finite duration (not `"unlimited"`, `"none"`, `"infinite"`, `"n/a"`). Long-running transactions hold row locks, prevent autovacuum, inflate WAL, and cause connection pile-ups.

BAD:
```json
{ "max_transaction_duration": "unlimited" }
{ "max_transaction_duration": "none" }
```
GOOD:
```json
{ "max_transaction_duration": "30s" }
{ "max_transaction_duration": "5m" }
```

### QPB004 — replica-timeout-tighter
Skipped if no workload declares `is_replica: true`. When replica workloads exist, their `statement_timeout` must be ≤ the maximum primary workload timeout. Long-running replica queries cause replication lag by conflicting with WAL replay on the primary.

BAD:
```json
{
  "workloads": {
    "oltp": { "statement_timeout": "5s" },
    "replica_read": { "statement_timeout": "30s", "is_replica": true }
  }
}
// replica 30s > primary 5s
```
GOOD:
```json
{
  "workloads": {
    "reports": { "statement_timeout": "30s" },
    "replica_read": { "statement_timeout": "30s", "is_replica": true }
  }
}
// replica ≤ primary
```

### QPB005 — latency-within-sla
Skipped if `spec.api_slo_ms` is not declared. When declared, each non-replica workload's `p99_latency_ms` must be ≤ `api_slo_ms × 0.7`. The database must consume ≤70% of the API response budget — the application layer needs headroom for network, business logic, and serialization.

BAD:
```json
{
  "api_slo_ms": 200,
  "workloads": { "oltp": { "p99_latency_ms": 180 } }
}
// 180ms > 200 × 0.7 = 140ms
```
GOOD:
```json
{
  "api_slo_ms": 200,
  "workloads": { "oltp": { "p99_latency_ms": 50 } }
}
// 50ms ≤ 140ms ✓
```

### QPB006 — no-vague-timeouts
Final sweep across all timeout fields (`statement_timeout`, `lock_timeout`, `idle_in_transaction_timeout`, `connect_timeout`, `max_transaction_duration`) at both top-level and per-workload. All values must be parseable duration strings.

Vague values blocked: `high`, `low`, `medium`, `fast`, `slow`, `acceptable`, `tbd`, `none`, `unlimited`, `infinite`, `n/a`, `ok`, `good`.

BAD:
```json
{ "workloads": { "background": { "statement_timeout": "acceptable" } } }
```
GOOD:
```json
{ "workloads": { "background": { "statement_timeout": "5m" } } }
```

---

## What This Compiler Never Forgives

- `query-performance-budget.json` missing (QPB001 hard-fails)
- `workloads` missing or empty (QPB001)
- `max_transaction_duration` missing (QPB001, QPB003)
- Workload `statement_timeout` missing (QPB002)
- `statement_timeout` not a valid duration format (QPB002)
- `statement_timeout` is a vague word (QPB002)
- `max_transaction_duration` is `"unlimited"`, `"none"`, `"infinite"` (QPB003)
- `max_transaction_duration` not parseable as a duration (QPB003)
- Replica workload `statement_timeout` > any primary workload timeout (QPB004)
- OLTP `p99_latency_ms` > `api_slo_ms × 0.7` (QPB005)
- Any timeout field set to a vague string (QPB006)
