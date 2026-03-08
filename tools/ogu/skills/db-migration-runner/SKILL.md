---
name: db-migration-runner
description: Compiler skill for the db_migration_runner compiler. Activates when producing db-migration-artifact.json. Gates: MR001–MR007. No upstream dependency.
---

# db-migration-runner — Compiler Skill

## What This Compiler Does

Compiles the database migration runner specification — migration tool, command, rollback strategy, timeout, and safety checks. Enforces: migration command is from an allowlisted set of safe tools, rollback command is declared, timeout is set, and the runner has a designated owner.

**Upstream dependency:** none
**Output artifact:** `db-migration-artifact.json`
**IR identifier:** `DB_MIGRATION_RUNNER:{project}`

---

## Spec Shape

```json
{
  "tool": "prisma",
  "command": "prisma migrate deploy",
  "rollbackCommand": "prisma migrate resolve --rolled-back",
  "timeout": 300,
  "database": "${DATABASE_URL}",
  "environments": ["staging", "production"],
  "owner": "backend-team",
  "dryRunFirst": true
}
```

Required fields:
- `tool` — migration tool name
- `command` — migration command to execute
- `environments` — target environments

---

## Gates

### MR001 — spec-valid
Reads `db-migration-spec.json`. Required: `tool`, `command`, `environments`.

Hard-fails if `db-migration-spec.json` is missing.

### MR002 — tool-recognized
`tool` must be a recognized migration framework. Unrecognized tools cannot be audited for safety.

Valid tools: `prisma`, `drizzle`, `flyway`, `liquibase`, `alembic`, `migrate`, `golang-migrate`, `typeorm`, `sequelize`, `knex`, `db-migrate`, `sqitch`.

BAD:
```json
{ "tool": "custom-migrator" }
```
GOOD:
```json
{ "tool": "prisma" }
```

### MR003 — command-allowlisted
`command` must be from the allowlist of safe migration commands. Arbitrary commands risk data destruction.

Allowlisted patterns:
- `prisma migrate deploy`
- `drizzle-kit migrate`
- `flyway migrate`
- `liquibase update`
- `alembic upgrade head`
- `migrate up`
- `golang-migrate -path ... up`
- Standard framework deploy/up commands

BAD:
```json
{ "command": "psql -c 'DROP TABLE users'" }
// arbitrary SQL — not a migration tool command
```
GOOD:
```json
{ "command": "prisma migrate deploy" }
```

### MR004 — no-literal-credentials
Database connection strings in `database` or `dsn` fields must use environment variable references.

BAD:
```json
{ "database": "postgres://admin:secret@db:5432/mydb" }
```
GOOD:
```json
{ "database": "${DATABASE_URL}" }
```

### MR005 — environments-declared
`environments` must be a non-empty array with valid environment names. Migrations without a declared target environment cannot be safely orchestrated.

### MR006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### MR007 — contract-migration
Final contract checks:
- `rollbackCommand` must be declared — migrations without rollback leave the database in an unknown state after failure
- `timeout` must be declared (positive integer, seconds) — migrations without timeout can hang indefinitely

BAD:
```json
{ "tool": "prisma", "command": "prisma migrate deploy", "environments": ["prod"] }
// no rollbackCommand, no timeout
```
GOOD:
```json
{
  "rollbackCommand": "prisma migrate resolve --rolled-back",
  "timeout": 300
}
```

---

## What This Compiler Never Forgives

- `db-migration-spec.json` missing (MR001 hard-fails)
- `tool`, `command`, or `environments` missing (MR001)
- `tool` not in recognized list (MR002)
- `command` not in allowlisted migration command patterns (MR003)
- Literal credentials in `database`/`dsn` fields (MR004)
- `environments` empty (MR005)
- `rollbackCommand` not declared (MR007)
- `timeout` not declared (MR007)
