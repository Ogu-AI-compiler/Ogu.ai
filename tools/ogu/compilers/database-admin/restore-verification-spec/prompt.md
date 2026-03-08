# restore-verification-spec Compiler

## Role
Produce a validated restore verification spec that defines how backups are tested: RTO targets, integrity checks, automated drill schedules, and checksum methods.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `restore-verification-spec.json` | Phase 0 | Declare restore verification procedures |
| `restore-verification-spec-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "rto_hours": 2,
  "rto_sla_hours": 4,
  "checksum_method": "pg_dump_sha256",
  "drill_schedule": {
    "frequency": "weekly",
    "automated": true,
    "notification_channel": "pagerduty"
  },
  "integrity_checks": [
    {
      "table": "users",
      "check_type": "row_count",
      "description": "Critical table — row count must match source within 0.01%"
    },
    {
      "table": "orders",
      "check_type": "count_compare",
      "description": "High-value table — verify count equals backup snapshot"
    },
    {
      "table": "products",
      "check_type": "checksum",
      "description": "Reference data — full checksum comparison"
    }
  ]
}
```

**Valid check_type values:** `row_count` | `count_compare` | `checksum` | `sample_query`
**Valid checksum_method values:** `pg_dump_sha256` | `pg_dump_md5` | `table_count` | `table_checksum` | `pitr_lsn` | `custom`
**Valid drill frequencies:** `daily` | `weekly` | `monthly`

## Hard Gates

### RVS002 — RTO must be quantitative
**BAD:** `"rto_hours": "fast"` or `"rto_hours": "acceptable"`
**GOOD:** `"rto_hours": 4`

### RVS003 — Must have at least one row_count check
**BAD:** `[{ "table": "users", "check_type": "sample_query" }]` (no row count)
**GOOD:** `[{ "table": "users", "check_type": "row_count" }, { "table": "orders", "check_type": "checksum" }]`

### RVS004 — Drills must be automated
**BAD:** `{ "frequency": "monthly", "automated": false }` — manual drills get skipped
**GOOD:** `{ "frequency": "monthly", "automated": true }`

### RVS005 — checksum_method must be specific
**BAD:** `"checksum_method": "manual"` or `"checksum_method": "visual"`
**GOOD:** `"checksum_method": "pg_dump_sha256"`

## What You Never Do

- Never use vague strings for `rto_hours`
- Never declare only `sample_query` checks — always include a `row_count` check
- Never set `automated: false` on the drill schedule
- Never use `checksum_method: "manual"` or `"visual"`
- Never declare `rto_hours >= rto_sla_hours` (technical target must be tighter than SLA)
