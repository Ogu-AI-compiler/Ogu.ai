# query-performance-budget Compiler

## Role
Produce a validated query performance budget that defines concrete, enforceable latency and timeout limits per workload class, bounded by API SLO requirements.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `query-performance-budget.json` | Phase 0 | Declare performance budgets |
| `query-performance-budget-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "api_slo_ms": 500,
  "max_transaction_duration": "30s",
  "workloads": {
    "oltp": {
      "statement_timeout": "5s",
      "lock_timeout": "2s",
      "idle_in_transaction_timeout": "10s",
      "p99_latency_ms": 200
    },
    "reports": {
      "statement_timeout": "60s",
      "p99_latency_ms": 3000
    },
    "background": {
      "statement_timeout": "10m",
      "p99_latency_ms": 5000
    },
    "replica_reads": {
      "statement_timeout": "5s",
      "p99_latency_ms": 200,
      "is_replica": true
    }
  }
}
```

## Hard Gates

### QPB003 — max_transaction_duration must be finite
**BAD:** `"max_transaction_duration": "unlimited"` or `"max_transaction_duration": "none"`
**GOOD:** `"max_transaction_duration": "30s"` or `"max_transaction_duration": "5m"`

### QPB004 — Replica timeouts cannot exceed primary
**BAD:** `{ "oltp": { "statement_timeout": "5s" }, "replica_reads": { "statement_timeout": "30s", "is_replica": true } }`
**GOOD:** `{ "oltp": { "statement_timeout": "5s" }, "replica_reads": { "statement_timeout": "5s", "is_replica": true } }`

### QPB005 — DB latency budget must be < 70% of API SLO
**BAD:** `{ "api_slo_ms": 500, "workloads": { "oltp": { "p99_latency_ms": 400 } } }` — 400 > 500*0.7=350
**GOOD:** `{ "api_slo_ms": 500, "workloads": { "oltp": { "p99_latency_ms": 200 } } }` — 200 <= 350

### QPB006 — All timeouts must be parseable durations
**BAD:** `"statement_timeout": "high"` or `"statement_timeout": "TBD"`
**GOOD:** `"statement_timeout": "5s"` or `"statement_timeout": "500ms"`

## What You Never Do

- Never set `max_transaction_duration` to "unlimited" or omit it
- Never set `is_replica: true` workload timeouts looser than primary timeouts
- Never use vague strings (high, fast, acceptable) for any timeout field
- Never let `p99_latency_ms` exceed 70% of `api_slo_ms`
- Never declare an empty workloads object
