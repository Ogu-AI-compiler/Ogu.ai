---
name: data-schema
description: Compiler skill for the data-schema compiler. Activates when producing schema-ds-artifact.json. Gates: DS001–DS009. Hard-fails when spec missing.
---

# data-schema — Compiler Skill

## What This Compiler Does

Compiles dataset schema definitions — validates spec structure, enforces typed column declarations (no imprecise `object`/`mixed` dtypes), requires nullable documentation, requires primary key declaration, enforces numeric range constraints, enforces categorical allowed-values, enforces PII masking declarations, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `schema-ds-artifact.json`
**IR identifier:** `DATA_SCHEMA:{project}`

---

## Spec Shape

```json
{
  "dataset": "customer_transactions",
  "description": "Customer purchase history with demographics",
  "version": "1.2.0",
  "primary_key": "transaction_id",
  "columns": [
    { "name": "transaction_id", "dtype": "int64", "primary_key": true },
    { "name": "age", "dtype": "int32", "min": 0, "max": 120 },
    { "name": "email", "dtype": "string", "pii": true, "masking": "hash-sha256" },
    { "name": "category", "dtype": "category", "allowed_values": ["A", "B", "C"] },
    { "name": "score", "dtype": "float64", "nullable": true, "null_strategy": "mean-impute" }
  ]
}
```

Required fields:
- `dataset` — string
- `columns` — non-empty array, each with `name` and `dtype`

---

## Gates

### DS001 — spec-valid
Reads `data-schema-spec.json`. Hard-fails if missing. Required: `dataset`, `columns` (non-empty, each with `name` and `dtype`).

BAD: spec missing or any column without `name` or `dtype`.
GOOD: all columns have both `name` and `dtype`.

### DS002 — schema-typed
Imprecise dtypes block column validation. Dtypes `object`, `mixed`, `inferred`, `auto`, `any` are blocked unless the column also sets `object_reason` (a string explaining why). Also checks Python code: `pa.DataFrameSchema` columns must not use `object` dtype without annotation.

BAD:
```json
{ "name": "description", "dtype": "object" }
```
GOOD:
```json
{ "name": "description", "dtype": "string" }
{ "name": "legacy_field", "dtype": "object", "object_reason": "mixed legacy format from v1" }
```

### DS003 — no-nullable-silent
Columns with `"nullable": true` must also declare `null_strategy` (a string describing how nulls are handled). Silent nullability hides data quality issues.

BAD:
```json
{ "name": "score", "dtype": "float64", "nullable": true }
```
GOOD:
```json
{ "name": "score", "dtype": "float64", "nullable": true, "null_strategy": "mean-impute" }
```
Escape: `null_documented: true` in the spec (top-level flag, means nulls are documented externally).

### DS004 — primary-key-defined
Spec must declare a primary key. Either `spec.primary_key` (string or array) at the top level, or a column with `primary_key: true`, `unique: true`, or `is_index: true`.

BAD: no `primary_key` field and no column marked as key/unique/index.
GOOD:
```json
{ "primary_key": "transaction_id" }
// OR
{ "name": "id", "dtype": "int64", "primary_key": true }
```
Escape: `noPrimaryKey: true` in spec (e.g., for streaming or log datasets).

### DS005 — range-constraints
Numeric columns must declare `min`/`max` OR set `no_range_constraint: true` with a `reason`. Numeric dtypes: `int8/16/32/64`, `uint*`, `float16/32/64`, `int`, `float`, `number`.

BAD:
```json
{ "name": "age", "dtype": "int32" }
```
GOOD:
```json
{ "name": "age", "dtype": "int32", "min": 0, "max": 120 }
{ "name": "log_id", "dtype": "int64", "no_range_constraint": true, "reason": "auto-increment, unbounded" }
```

### DS006 — categorical-constraints
Categorical columns (dtype `category`, `bool`, or `string` with a `categorical` annotation) must declare either `allowed_values` (array) or `open_ended: true` with `examples`.

BAD:
```json
{ "name": "status", "dtype": "category" }
```
GOOD:
```json
{ "name": "status", "dtype": "category", "allowed_values": ["active", "inactive", "pending"] }
{ "name": "country", "dtype": "category", "open_ended": true, "examples": ["US", "UK", "DE"] }
```

### DS007 — no-pii-unmasked
PII columns (names matching: `email`, `ssn`, `phone`, `dob`, `passport`, `national_id`, `credit_card`, `full_name`, `first_name`, `last_name`, `ip_addr`, `geo_loc`) must declare `pii: true` AND a `masking` strategy string.

BAD:
```json
{ "name": "email", "dtype": "string" }
```
GOOD:
```json
{ "name": "email", "dtype": "string", "pii": true, "masking": "hash-sha256" }
{ "name": "phone", "dtype": "string", "pii": true, "masking": "tokenize" }
```
Escape: `pii_reviewed: true` on the column (certifies manual review).

### DS008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### DS009 — contract-schema
Final contract check (RULES array — no escape hatch):
- `dataset` field present
- `columns` array non-empty
- All columns have `dtype` (all-typed)
- `version` field present
- `description` field present

---

## What This Compiler Never Forgives

- `data-schema-spec.json` missing (DS001 hard-fails)
- `dataset` or `columns` missing (DS001)
- Any column without `dtype` (DS001, DS009)
- Imprecise dtype (`object`/`mixed`/`inferred`/`auto`/`any`) without `object_reason` (DS002)
- `nullable: true` without `null_strategy` (DS003)
- No primary key declared anywhere (DS004)
- Numeric column without `min`/`max` and without `no_range_constraint` (DS005)
- Categorical column without `allowed_values` and without `open_ended: true` (DS006)
- PII column name without `pii: true` + `masking` (DS007)
- TODO/FIXME/HACK/XXX anywhere (DS008)
- Missing `version` or `description` at schema level (DS009)
