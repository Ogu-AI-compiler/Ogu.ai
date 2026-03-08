---
name: backup-verification-job
description: Compiler skill for the backup_verification_job compiler. Activates when producing backup-verify-artifact.json. Gates: BV001–BV007. No upstream dependency.
---

# backup-verification-job — Compiler Skill

## What This Compiler Does

Compiles the backup verification job specification — backup source, restore target, verification queries, result artifact path, schedule, and alert configuration. Enforces: restore target is never production, every verification query has an assertion, result artifacts are declared, a schedule or trigger is defined, and failure alerting is configured.

**Upstream dependency:** none
**Output artifact:** `backup-verify-artifact.json`
**IR identifier:** `BACKUP_VERIFY:{project}`

---

## Spec Shape

```json
{
  "backupSource": {
    "type": "s3",
    "bucket": "prod-db-backups",
    "prefix": "daily/"
  },
  "restoreTarget": {
    "type": "postgres",
    "connection": "RESTORE_DB_URL",
    "environment": "staging"
  },
  "verifyQueries": [
    {
      "name": "row-count-check",
      "sql": "SELECT COUNT(*) FROM users",
      "assertion": { "gte": 1000 }
    },
    {
      "name": "recent-data-check",
      "sql": "SELECT MAX(created_at) FROM orders",
      "assertion": { "withinDays": 2 }
    }
  ],
  "resultArtifactPath": "reports/backup-verify-{date}.json",
  "schedule": "0 3 * * *",
  "notifyOnFailure": {
    "channel": "#ops-alerts",
    "owner": "platform-team"
  }
}
```

Required fields:
- `backupSource` — object describing where backups are sourced
- `restoreTarget` — object describing where to restore
- `verifyQueries` — non-empty array of verification queries

---

## Gates

### BV001 — spec-valid
Reads `backup-verify-spec.json`. Required: `backupSource`, `restoreTarget`, `verifyQueries` (non-empty array).

Hard-fails if `backup-verify-spec.json` is missing.

### BV002 — no-production-restore-target
`restoreTarget` must not point to production. Restoring a backup to production overwrites live data. Blocked keywords: `production`, `prod`, `live`, `prd`.

BAD:
```json
{ "restoreTarget": { "environment": "production" } }
{ "restoreTarget": { "connection": "PROD_DB_URL" } }
```
GOOD:
```json
{ "restoreTarget": { "environment": "staging", "connection": "RESTORE_DB_URL" } }
```

### BV003 — queries-have-assertions
Every verification query must declare an `assertion`. A query without assertion runs but never fails — the verification job becomes a no-op that always reports success.

BAD:
```json
{ "verifyQueries": [{ "name": "count", "sql": "SELECT COUNT(*) FROM users" }] }
// no assertion — cannot detect data loss
```
GOOD:
```json
{
  "verifyQueries": [{
    "name": "count",
    "sql": "SELECT COUNT(*) FROM users",
    "assertion": { "gte": 1000 }
  }]
}
```

### BV004 — result-artifact-declared
`resultArtifactPath` must be declared. Backup verification without a persisted result is invisible — no audit trail, no trend analysis.

BAD:
```json
{}
// no resultArtifactPath — results are ephemeral
```
GOOD:
```json
{ "resultArtifactPath": "reports/backup-verify-{date}.json" }
```

### BV005 — schedule-or-trigger-defined
At least one of `schedule` (cron expression), `trigger`, or `runAfterBackup: true` must be declared. A verification job with no trigger never runs.

BAD:
```json
{ "backupSource": {}, "restoreTarget": {}, "verifyQueries": [] }
// no schedule, no trigger
```
GOOD:
```json
{ "schedule": "0 3 * * *" }
// OR
{ "runAfterBackup": true }
```

### BV006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### BV007 — contract-verify
Final contract checks:
- `notifyOnFailure` or `alertChannel` must be declared — silent failures defeat the purpose
- `owner` must be declared (directly or inside `notifyOnFailure`)

BAD:
```json
{ "backupSource": {}, "restoreTarget": {}, "verifyQueries": [{}] }
// no notification config — failures go undetected
```
GOOD:
```json
{
  "notifyOnFailure": {
    "channel": "#ops-alerts",
    "owner": "platform-team"
  }
}
```

---

## What This Compiler Never Forgives

- `backup-verify-spec.json` missing (BV001 hard-fails)
- `backupSource`, `restoreTarget`, or `verifyQueries` missing (BV001)
- `verifyQueries` is empty (BV001)
- `restoreTarget` points to production/prod/live/prd (BV002)
- Any verification query missing `assertion` (BV003)
- `resultArtifactPath` not declared (BV004)
- No `schedule`, `trigger`, or `runAfterBackup: true` (BV005)
- No failure notification config (BV007)
- No `owner` declared (BV007)
