---
name: index-advisory-spec
description: Compiler skill for the index-advisory-spec compiler. Activates when producing index-advisory-artifact.json. Gates: IAS001–IAS006. No upstream dependency.
---

# index-advisory-spec — Compiler Skill

## What This Compiler Does

Compiles the database index advisory specification — add/remove/retain actions with rationale, redundancy detection, write-heavy table limits, and removal reasons. Enforces: every `add` action has a meaningful rationale (not vague), no table exceeds 10 total indexes without a waiver, no redundant/prefix-duplicate indexes, write-heavy tables don't receive >3 new indexes without a waiver, and every `remove` action has a documented reason.

**Upstream dependency:** none
**Output artifact:** `index-advisory-artifact.json`
**IR identifier:** `INDEX_ADVISORY:{project}`

---

## Spec Shape

```json
{
  "indexes": [
    {
      "table": "users",
      "action": "add",
      "columns": ["email"],
      "rationale": "Users lookup by email for login — 10k RPM OLTP query, currently doing sequential scan on 5M rows",
      "existing_index_count": 3
    },
    {
      "table": "orders",
      "action": "add",
      "columns": ["user_id", "created_at"],
      "rationale": "Orders history pagination query — compound index for user+time range filter used in dashboard",
      "write_heavy": false
    },
    {
      "table": "events",
      "action": "remove",
      "index_name": "idx_events_session_id",
      "reason": "Unused — 0 scans in 90 days per pg_stat_user_indexes; replaced by composite idx_events_session_created"
    },
    {
      "table": "products",
      "action": "retain",
      "columns": ["sku"],
      "rationale": "Primary lookup index — kept for uniqueness enforcement"
    }
  ]
}
```

Required fields:
- `indexes` — array of index actions (can be empty but must be declared)

Each index entry requires:
- `table` — table name
- `action` — `"add"`, `"remove"`, or `"retain"`
- `columns` — non-empty array (for `add` and `retain`)
- For `remove`: `index_name` or `columns`

---

## Gates

### IAS001 — spec-valid
Reads `index-advisory-spec.json`. Required: `indexes` (array). Each entry needs `table`, valid `action`, and `columns` (non-empty for add/retain).

Hard-fails if `index-advisory-spec.json` is missing.

### IAS002 — rationale-required
Every `"add"` action must have a `rationale` field that is:
- Non-empty
- At least 20 characters
- Not a vague single word: `"performance"`, `"speed"`, `"fast"`, `"needed"`, `"required"`, `"tbd"`, `"todo"`

Indexes are not free — each one adds write overhead. An unexplained index becomes technical debt.

BAD:
```json
{ "table": "users", "action": "add", "columns": ["email"], "rationale": "performance" }
// too vague
```
```json
{ "table": "orders", "action": "add", "columns": ["user_id"] }
// no rationale at all
```
GOOD:
```json
{
  "table": "users",
  "action": "add",
  "columns": ["email"],
  "rationale": "Users lookup by email for login — 10k RPM OLTP query, currently full seq scan on 5M rows"
}
```

### IAS003 — max-indexes-per-table
After applying the advisory (existing + add - remove), no table may exceed 10 total indexes without a waiver.

Waiver: set `index_limit_waiver: true` with `index_limit_waiver_justification` on the entry.

BAD:
```json
{ "table": "orders", "existing_index_count": 9, "action": "add", "columns": ["col"] }
// projected total: 10 + 1 = 11 — exceeds limit
```
GOOD:
```json
{
  "table": "orders",
  "existing_index_count": 9,
  "action": "add",
  "columns": ["col"],
  "index_limit_waiver": true,
  "index_limit_waiver_justification": "High-cardinality OLAP table requires compound indexes for report queries"
}
```

### IAS004 — no-redundant-indexes
Detects redundant index additions within the same table:
- Exact duplicate — two indexes on exactly the same columns in the same order
- Prefix redundancy — index on `[A]` when `[A, B]` already exists (PostgreSQL can use `[A,B]` for A-only queries)

Escape: set `redundant_ok: true` on the shorter index if it has a distinct predicate or `INCLUDE` columns.

BAD:
```json
[
  { "table": "users", "action": "add", "columns": ["email"] },
  { "table": "users", "action": "add", "columns": ["email", "created_at"] }
]
// [email] is a prefix of [email, created_at] — redundant
```
GOOD: Only the compound index, or mark the single-column one `redundant_ok: true` with a partial predicate justification.

### IAS005 — write-heavy-not-over-indexed
Tables declared `write_heavy: true` must not receive more than 3 new `"add"` index actions in one advisory spec.

Waiver: set `write_heavy_index_waiver: true` with `write_heavy_index_waiver_justification`.

BAD:
```json
[
  { "table": "events", "action": "add", "columns": ["col1"], "write_heavy": true },
  { "table": "events", "action": "add", "columns": ["col2"], "write_heavy": true },
  { "table": "events", "action": "add", "columns": ["col3"], "write_heavy": true },
  { "table": "events", "action": "add", "columns": ["col4"], "write_heavy": true }
]
// 4 adds on write_heavy table — exceeds limit of 3
```
GOOD: ≤ 3 additions per write-heavy table, or use waiver with justification.

### IAS006 — remove-has-reason
Every `"remove"` action must have a `reason` field of at least 15 characters. Recreating a dropped index on a large table can take hours — every removal must be documented.

BAD:
```json
{ "table": "events", "action": "remove", "index_name": "idx_old" }
// no reason
```
```json
{ "table": "events", "action": "remove", "index_name": "idx_old", "reason": "old" }
// too short
```
GOOD:
```json
{
  "table": "events",
  "action": "remove",
  "index_name": "idx_old",
  "reason": "Unused — 0 scans in 90 days per pg_stat_user_indexes; replaced by composite idx_events_session_created"
}
```

---

## What This Compiler Never Forgives

- `index-advisory-spec.json` missing (IAS001 hard-fails)
- `indexes` field missing (IAS001)
- Any entry missing `table` or `action` (IAS001)
- `action` not `add`/`remove`/`retain` (IAS001)
- `add`/`retain` entry with missing or empty `columns` (IAS001)
- `add` entry missing `rationale` (IAS002)
- Rationale shorter than 20 characters (IAS002)
- Rationale is a vague word (`performance`, `tbd`, `needed`, etc.) (IAS002)
- Projected index count > 10 without waiver + justification (IAS003)
- Exact duplicate index columns on same table (IAS004)
- Prefix-redundant index without `redundant_ok: true` (IAS004)
- > 3 `add` actions on `write_heavy` table without waiver (IAS005)
- Waiver without justification (IAS003, IAS005)
- `remove` action missing `reason` (IAS006)
- `reason` shorter than 15 characters (IAS006)
