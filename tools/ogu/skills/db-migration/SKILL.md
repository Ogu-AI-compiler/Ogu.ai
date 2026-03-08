---
name: db-migration
description: Compiler skill for the db-migration compiler. Activates when producing migration-artifact.json. Gates: DM001–DM012. Upstream: optionally schema-artifact.json. Downstream: api-route (cross-migration gate).
---

# db-migration — Compiler Skill

## What This Compiler Does

Compiles a database migration with verified rollback guarantee, idempotency guards, and FK index coverage. Enforces that every up operation has a down inverse, destructive ops are gated, and the migration follows naming, timestamp, and id-column conventions.

**Upstream dependency:** optionally `schema-artifact.json` (ts-schema)
**Output artifact:** `migration-artifact.json` (consumed by `api-route` cross-migration gate)
**IR identifiers:** `TABLE:{tableName}`, `COLUMN:{table}.{col}`, `INDEX:{name}`, `MIGRATION:{version}_{name}`
**Files you create:** `migration-spec.json`, `up.sql`, `down.sql`

---

## Spec Shape

```json
{
  "version": "001",
  "name": "create_users",
  "table": "users",
  "operation": "create",
  "columns": [
    { "name": "id",         "type": "UUID",                   "primaryKey": true },
    { "name": "email",      "type": "VARCHAR(255)",            "unique": true },
    { "name": "name",       "type": "VARCHAR(255)" },
    { "name": "created_at", "type": "TIMESTAMP NOT NULL",      "default": "NOW()" },
    { "name": "updated_at", "type": "TIMESTAMP NOT NULL",      "default": "NOW()" }
  ],
  "foreignKeys": [
    { "column": "org_id", "references": "organizations(id)" }
  ]
}
```

Valid `operation` values: `create` | `alter` | `drop` | `rename`

---

## Gates

### DM001 — spec-valid
Reads `migration-spec.json`. Fails if missing.

Required fields: `version`, `name`, `table`, `operation`, `columns` (non-empty array).

- `version`: zero-padded integer string with ≥3 digits — `"001"`, `"042"`, etc.
- `table`: snake_case — `^[a-z][a-z0-9_]*$`
- `operation`: one of `create`, `alter`, `drop`, `rename`
- Each column: `name` (snake_case) and `type` (SQL type string)

BAD: `"version": "1"` — must be `"001"`. `"table": "UserProfiles"` — must be snake_case. Column missing `type`.
GOOD: `"version": "003"`, `"table": "user_profiles"`, columns all have `name` and `type`.

### DM002 — cross-schema
Skips (passes) if no `schema-artifact.json` found.

When the schema artifact exists, it is the source of truth:
- Every non-meta schema field must have a matching column
- Every non-meta column must map to a schema field
- Column SQL type must be compatible with schema field type

Meta columns exempt from both checks: `id`, `created_at`, `updated_at`, `deleted_at`.

Schema field → SQL type compatibility:

| Schema type | Accepted SQL types |
|---|---|
| `uuid` | UUID, VARCHAR(36), CHAR(36) |
| `email` | VARCHAR, TEXT |
| `string` | VARCHAR, TEXT, CHAR |
| `number` | INTEGER, INT, BIGINT, DECIMAL, NUMERIC, FLOAT, DOUBLE |
| `boolean` | BOOLEAN, BOOL, TINYINT(1) |
| `date` | TIMESTAMP, DATETIME, DATE, TIMESTAMPTZ |
| `object`/`array` | JSONB, JSON, TEXT |

BAD: Schema has `firstName` (→ `first_name`) but migration has no `first_name` column. Migration has `display_name` column but no such field in schema.
GOOD: Compile ts-schema first; align column names exactly (schema camelCase → snake_case).

### DM003 — up-valid
`up.sql` must exist and contain at least one DDL statement: `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX`, `CREATE SEQUENCE`, `CREATE TYPE`.

Parentheses must be balanced. `SELECT` statements in `up.sql` are forbidden — use seed scripts for data queries.

BAD: `up.sql` is empty. `up.sql` contains `SELECT * FROM users` — no data queries in migrations.
GOOD: Valid DDL with balanced parentheses and no SELECT.

### DM004 — down-valid
`down.sql` must exist, be non-empty, and contain the inverse of every operation in `up.sql`:

| up.sql | Required in down.sql |
|---|---|
| `CREATE TABLE {name}` | `DROP TABLE {name}` |
| `CREATE [UNIQUE] INDEX {name}` | `DROP INDEX {name}` |
| `CREATE TYPE {name}` | `DROP TYPE {name}` |
| `ALTER TABLE {t} ADD COLUMN {c}` | `ALTER TABLE {t} DROP COLUMN {c}` |

`down.sql` must also contain DDL (`DROP`, `ALTER`, or `TRUNCATE`) — an empty or comment-only down.sql fails.

BAD: `up.sql` creates table `users` but `down.sql` has no `DROP TABLE users`.
GOOD: `down.sql` mirrors every create/add in reverse.

### DM005 — no-todos
Checks `up.sql`, `down.sql`, `migration-spec.json`.

Blocked markers: `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`, `XXX` (case-insensitive).

### DM006 — no-destructive
In `up.sql`, the following are blocked unless `spec.allowDestructive: true`:
- `DROP TABLE` (in up.sql belongs in down.sql)
- `ALTER TABLE ... DROP COLUMN`
- `TRUNCATE`
- `DROP DATABASE`
- `ALTER TABLE ... MODIFY COLUMN` (potential data loss)

To enable: add `"allowDestructive": true` to `migration-spec.json`.

BAD: `up.sql` contains `TRUNCATE users` with no allowDestructive flag.
GOOD: Drops go in `down.sql`. If a forward-migration genuinely needs a drop, set `"allowDestructive": true` in spec.

### DM007 — idempotent
All create/drop operations must use `IF NOT EXISTS` / `IF EXISTS` guards:

| Operation | Required form |
|---|---|
| `CREATE TABLE` in up.sql | `CREATE TABLE IF NOT EXISTS` |
| `CREATE INDEX` in up.sql | `CREATE INDEX IF NOT EXISTS` |
| `DROP TABLE` in down.sql | `DROP TABLE IF EXISTS` |
| `DROP INDEX` in down.sql | `DROP INDEX IF EXISTS` |

BAD: `CREATE TABLE users (...)` — fails if table already exists.
GOOD: `CREATE TABLE IF NOT EXISTS users (...)`.

### DM008 — rollback-complete
Stricter than DM004 — uses structural analysis. For each detected operation in `up.sql`, a matching inverse must be present in `down.sql`:

`CREATE_TABLE`, `CREATE_INDEX`, `CREATE_TYPE`, `CREATE_SEQUENCE`, `ADD_COLUMN` are all tracked.

BAD: `up.sql` creates both `users` table and `idx_users_email` index, but `down.sql` only drops the table — missing `DROP INDEX idx_users_email`.
GOOD: Every create has a corresponding drop; every add column has a corresponding drop column.

### DM009 — pk-not-nullable
Primary key columns must not be explicitly nullable. Blocked patterns:

- Inline: `id UUID PRIMARY KEY NULL` — PK with explicit `NULL` keyword
- Table-level: `CONSTRAINT pk PRIMARY KEY (id)` where the `id` column definition has `NULL` without `NOT NULL`

Most databases imply `NOT NULL` on primary keys, but explicit `NULL` overrides this and must be rejected.

BAD: `id UUID NULL PRIMARY KEY` — explicit NULL on PK column.
GOOD: `id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`.

### DM010 — fk-indexed
Every foreign key column must have a `CREATE INDEX` in `up.sql`.

FK columns detected from:
- Inline syntax: `col_name TYPE REFERENCES other_table(id)`
- Constraint syntax: `FOREIGN KEY (col_name) REFERENCES ...`
- `spec.foreignKeys[].column` or `spec.foreignKeys[].columns[]`

BAD: `org_id UUID REFERENCES organizations(id)` but no `CREATE INDEX ... ON users(org_id)`.
GOOD:
```sql
CREATE INDEX IF NOT EXISTS users_org_id_idx ON users(org_id);
```

### DM011 — version-sequential
- `version` must be a zero-padded integer string (≥3 digits): `"001"`, `"002"`, etc.
- Must not conflict with any sibling migration in the same feature directory
- Must not skip versions (if existing migrations go up to `002`, this must be `003`)

BAD: `"version": "005"` when existing migrations are `001` and `002` — version gap.
BAD: `"version": "002"` when another migration also has `"002"`.
GOOD: Sequential, zero-padded, unique.

### DM012 — contract-migration
Four rules checked against `up.sql` and `migration-spec.json`:

**timestamp-columns:** `CREATE TABLE` must have `created_at` and `updated_at`, both `NOT NULL DEFAULT NOW()` (or `DEFAULT CURRENT_TIMESTAMP`).

**soft-delete:** If `spec.softDelete: true`, `deleted_at TIMESTAMP NULL` must be present.

**id-convention:** `id` column must use `UUID`, `BIGSERIAL`, `SERIAL`, or `BIGINT`.

**snake-case-columns:** camelCase identifiers in SQL (excluding SQL keywords) fail. All column names must be snake_case.

**no-select-in-migration:** `SELECT` at the start of any line is blocked.

BAD: `CREATE TABLE users (id UUID, createdAt TIMESTAMP)` — camelCase and missing `NOT NULL DEFAULT NOW()`.
GOOD:
```sql
CREATE TABLE IF NOT EXISTS users (
  id         UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email      VARCHAR(255)  NOT NULL UNIQUE,
  created_at TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP     NOT NULL DEFAULT NOW()
);
```

---

## What This Compiler Never Forgives

- `migration-spec.json` or `up.sql` missing (DM001/DM003 hard-fail)
- `down.sql` missing — every migration requires a rollback (DM004)
- `CREATE TABLE` without `IF NOT EXISTS` — must be idempotent (DM007)
- FK column with no `CREATE INDEX` (DM010)
- Missing `created_at` / `updated_at` on new tables, or without `NOT NULL DEFAULT NOW()` (DM012)
- `id` column not using UUID/BIGSERIAL/SERIAL (DM012)
- camelCase column names — always snake_case (DM012)
- SELECT in `up.sql` — use seed scripts for data (DM003 + DM012)
- `DROP TABLE` in `up.sql` without `allowDestructive: true` (DM006)
- Version conflicts or gaps (DM011)
