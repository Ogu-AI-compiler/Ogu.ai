---
name: data-seed-job
description: Compiler skill for the data_seed_job compiler. Activates when producing data-seed-artifact.json. Gates: DS001–DS007. No upstream dependency.
---

# data-seed-job — Compiler Skill

## What This Compiler Does

Compiles the data seed job specification — name, command, target environments, script path, idempotency contract, and database references. Enforces: seed script exists on disk, idempotency is declared (seeds must be safe to run multiple times), production targeting requires explicit override, database refs use env vars not literal credentials, and owner is declared.

**Upstream dependency:** none
**Output artifact:** `data-seed-artifact.json`
**IR identifier:** `DATA_SEED:{project}`

---

## Spec Shape

```json
{
  "name": "product-catalog-seed",
  "command": "node scripts/seed-products.js",
  "scriptPath": "scripts/seed-products.js",
  "targetEnvironments": ["staging", "dev"],
  "idempotencyContract": "upsert",
  "dbRefs": [
    { "name": "DB_URL", "envKey": "DATABASE_URL" }
  ],
  "owner": "data-team",
  "runOrder": 1
}
```

Required fields:
- `name` — string
- `command` — shell command to run the seed
- `targetEnvironments` — non-empty array of environment names

---

## Gates

### DS001 — spec-valid
Reads `data-seed-spec.json`. Required: `name`, `command`, `targetEnvironments` (non-empty array).

Hard-fails if `data-seed-spec.json` is missing.

### DS002 — script-exists
When `scriptPath` is declared, the file must exist on disk. A declared but missing script is a broken reference.

BAD: `"scriptPath": "scripts/seed.js"` but file doesn't exist.
GOOD: File exists at the declared path.

### DS003 — idempotency-declared
`idempotencyContract` must be declared. Seed jobs that are not idempotent corrupt data when run more than once (e.g., during retries or environment resets).

Valid values: `upsert`, `truncate-insert`, `insert-if-absent`, `conditional`, `custom`.

BAD:
```json
{ "name": "seed", "command": "node seed.js", "targetEnvironments": ["dev"] }
// no idempotencyContract — re-running duplicates data
```
GOOD:
```json
{ "idempotencyContract": "upsert" }
```

### DS004 — no-production-without-override
If `targetEnvironments` includes production keywords (`production`, `prod`, `live`, `prd`), `productionOverride: true` must be explicitly declared.

BAD:
```json
{ "targetEnvironments": ["production"] }
// seeding production without explicit override
```
GOOD:
```json
{ "targetEnvironments": ["production"], "productionOverride": true }
```

### DS005 — db-refs-use-env-vars
All database references in `dbRefs` must use `envKey` or `secretName` — not literal connection strings. Literal DB credentials in specs get committed to source control.

BAD:
```json
{ "dbRefs": [{ "name": "DB_URL", "value": "postgres://user:pass@host/db" }] }
```
GOOD:
```json
{ "dbRefs": [{ "name": "DB_URL", "envKey": "DATABASE_URL" }] }
```

### DS006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DS007 — contract-seed
Final contract checks:
- `idempotencyContract` must be declared (redundant final check)
- `owner` must be declared — orphaned seed jobs have no one to call when they fail

BAD:
```json
{ "name": "seed", "command": "node seed.js", "targetEnvironments": ["dev"] }
// no owner
```
GOOD:
```json
{ "idempotencyContract": "upsert", "owner": "data-team" }
```

---

## What This Compiler Never Forgives

- `data-seed-spec.json` missing (DS001 hard-fails)
- `name`, `command`, or `targetEnvironments` missing (DS001)
- `targetEnvironments` empty (DS001)
- `scriptPath` declared but file missing on disk (DS002)
- `idempotencyContract` not declared (DS003)
- Production in `targetEnvironments` without `productionOverride: true` (DS004)
- `dbRefs` using literal connection strings instead of `envKey`/`secretName` (DS005)
- `owner` not declared (DS007)
