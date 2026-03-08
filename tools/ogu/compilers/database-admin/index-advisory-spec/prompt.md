# index-advisory-spec Compiler

## Role
Produce a validated index advisory spec that defines which indexes to add, remove, or retain — with rationale for additions and reasons for removals — while preventing redundancy and write-heavy table over-indexing.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `index-advisory-spec.json` | Phase 0 | Declare index actions |
| `index-advisory-spec-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "indexes": [
    {
      "table": "users",
      "action": "add",
      "columns": ["email"],
      "unique": true,
      "rationale": "Users lookup by email for login flow — ~10k RPM OLTP query with full-table-scan without this index",
      "write_heavy": false
    },
    {
      "table": "orders",
      "action": "add",
      "columns": ["user_id", "created_at"],
      "rationale": "Order history pagination query — filters by user_id and sorts by created_at DESC on 50M row table",
      "existing_index_count": 3
    },
    {
      "table": "audit_logs",
      "action": "remove",
      "index_name": "idx_audit_logs_old_session_id",
      "table": "audit_logs",
      "reason": "Unused — 0 index scans in past 90 days per pg_stat_user_indexes. Replaced by composite idx_audit_logs_user_created.",
      "write_heavy": true
    },
    {
      "table": "products",
      "action": "retain",
      "columns": ["sku"],
      "unique": true
    }
  ]
}
```

**action values:** `add` | `remove` | `retain`

## Hard Gates

### IAS002 — All "add" actions need rationale
**BAD:** `{ "action": "add", "columns": ["email"], "rationale": "performance" }` — vague
**BAD:** `{ "action": "add", "columns": ["email"] }` — missing rationale
**GOOD:** `{ "action": "add", "columns": ["email"], "rationale": "Login query scans full users table without this — 10k RPM" }`

### IAS004 — No redundant indexes
**BAD:** Two entries: `columns: ["user_id"]` AND `columns: ["user_id", "created_at"]` on the same table — first is prefix-redundant
**GOOD:** Only `columns: ["user_id", "created_at"]` (serves both query patterns)

### IAS005 — Write-heavy tables: max 3 new indexes
**BAD:** 5 "add" actions for a table with `write_heavy: true`
**GOOD:** 2 "add" actions, or 5 with `write_heavy_index_waiver: true` + justification

### IAS006 — "remove" actions need reason
**BAD:** `{ "action": "remove", "index_name": "idx_old" }` — no reason
**GOOD:** `{ "action": "remove", "index_name": "idx_old", "reason": "Unused — 0 scans in 90 days via pg_stat_user_indexes" }`

## What You Never Do

- Never add an index without a rationale that explains the specific query pattern
- Never create duplicate or prefix-redundant indexes on the same table
- Never add more than 3 indexes to a `write_heavy: true` table without a waiver
- Never remove an index without a documented reason
- Never exceed 10 total indexes per table without `index_limit_waiver: true`
