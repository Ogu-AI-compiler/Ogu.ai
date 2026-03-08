---
name: db-backup-job
description: Compiler skill for the db_backup_job compiler. Activates when producing db-backup-artifact.json. Gates: DBB001–DBB007. No upstream dependency.
---

# db-backup-job — Compiler Skill

## What This Compiler Does

Compiles the database backup job specification — command, destination, schedule, retention, checksum, credentials, and storage configuration. Enforces: schedule runs at least daily, retention count and days are positive, checksum generation is declared, no literal credentials in the spec, and encryption + storage destination are configured.

**Upstream dependency:** none
**Output artifact:** `db-backup-artifact.json`
**IR identifier:** `DB_BACKUP:{project}`

---

## Spec Shape

```json
{
  "command": "pg_dump ${DB_URL} | gzip",
  "destination": "s3://backups-bucket/postgres/{date}",
  "schedule": "0 2 * * *",
  "retentionCount": 30,
  "checksum": {
    "algorithm": "sha256",
    "storeWith": "artifact"
  },
  "encryptionEnabled": true,
  "storageClass": "STANDARD_IA",
  "storageDestination": "s3",
  "owner": "platform-team"
}
```

Required fields:
- `command` — backup command
- `destination` — backup destination path/URL
- `schedule` — cron expression
- `retentionCount` — number of backups to retain

---

## Gates

### DBB001 — spec-valid
Reads `db-backup-spec.json`. Required: `command`, `destination`, `schedule`, `retentionCount`.

Hard-fails if `db-backup-spec.json` is missing.

### DBB002 — schedule-at-least-daily
Schedule must be a valid cron expression and run at least once per day. Weekly or monthly schedules are too infrequent for database backups.

Valid: any cron expression where the interval is ≤ 24 hours.

BAD:
```json
{ "schedule": "0 0 * * 0" }
// weekly — 7 days of potential data loss
```
GOOD:
```json
{ "schedule": "0 2 * * *" }
// daily at 2 AM
```

### DBB003 — retention-positive
`retentionCount` (if declared) and `retentionDays` (if declared) must be positive integers. Zero retention means backups are immediately deleted.

BAD:
```json
{ "retentionCount": 0 }
{ "retentionDays": -1 }
```
GOOD:
```json
{ "retentionCount": 30, "retentionDays": 90 }
```

### DBB004 — checksum-generation
`checksum` must be declared with `algorithm` (sha256 recommended) and a storage strategy. Backups without checksums cannot be verified for integrity — corruption goes undetected.

BAD:
```json
{ "command": "pg_dump ...", "destination": "s3://...", "schedule": "0 2 * * *", "retentionCount": 30 }
// no checksum config
```
GOOD:
```json
{ "checksum": { "algorithm": "sha256", "storeWith": "artifact" } }
```

### DBB005 — no-literal-credentials
The spec must not contain literal database credentials. Fields like `command`, `destination`, or custom fields must use environment variable references (`${VAR}`) for any passwords, tokens, or connection strings.

BAD:
```json
{ "command": "pg_dump postgres://admin:secret123@db-host/mydb" }
```
GOOD:
```json
{ "command": "pg_dump ${DATABASE_URL}" }
```

### DBB006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DBB007 — contract-backup
Final contract checks:
- `encryptionEnabled: true` must be declared — unencrypted backups expose all data if the storage bucket is misconfigured
- `storageClass` or `storageDestination` must be declared — backup storage tier affects cost and availability SLA

BAD:
```json
{ "command": "pg_dump ...", "destination": "s3://...", "schedule": "0 2 * * *", "retentionCount": 30 }
// no encryption, no storage class
```
GOOD:
```json
{
  "encryptionEnabled": true,
  "storageClass": "STANDARD_IA",
  "storageDestination": "s3"
}
```

---

## What This Compiler Never Forgives

- `db-backup-spec.json` missing (DBB001 hard-fails)
- `command`, `destination`, `schedule`, or `retentionCount` missing (DBB001)
- Schedule runs less frequently than daily (DBB002)
- Invalid cron expression (DBB002)
- `retentionCount` or `retentionDays` is 0 or negative (DBB003)
- `checksum` not declared (DBB004)
- Literal credentials in `command` or connection fields (DBB005)
- `encryptionEnabled` not `true` (DBB007)
- `storageClass` and `storageDestination` both missing (DBB007)
