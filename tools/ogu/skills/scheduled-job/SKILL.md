---
name: scheduled-job
description: Compiler skill for the scheduled_job compiler. Activates when producing scheduled-job-artifact.json. Gates: SJ001–SJ008. No upstream dependency.
---

# scheduled-job — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes CronJob / scheduled job specification — cron expression, container image, concurrency policy, job history limits, secret references, and ownership. Enforces: cron expression is syntactically valid, concurrency policy is explicitly set, history limit values are non-negative integers, env refs with `secret: true` have a `secretName`, and owner is declared.

**Upstream dependency:** none
**Output artifact:** `scheduled-job-artifact.json`
**IR identifier:** `SCHEDULED_JOB:{project}`

---

## Spec Shape

```json
{
  "name": "nightly-report",
  "schedule": "0 2 * * *",
  "command": ["node", "scripts/generate-report.js"],
  "image": "registry.example.com/report-generator:1.2.3",
  "concurrencyPolicy": "Forbid",
  "backoffLimit": 3,
  "successfulJobsHistoryLimit": 3,
  "failedJobsHistoryLimit": 5,
  "envRefs": [
    { "name": "DATABASE_URL", "envKey": "DATABASE_URL", "secret": true, "secretName": "db-credentials" },
    { "name": "REPORT_BUCKET", "envKey": "REPORT_BUCKET" }
  ],
  "owner": "data-team"
}
```

Required fields:
- `name` — job name
- `schedule` — cron expression or shorthand
- `command` — command array or string
- `image` — container image reference

---

## Gates

### SJ001 — spec-valid
Reads `scheduled-job-spec.json`. Required: `name`, `schedule`, `command`, `image`.

Hard-fails if `scheduled-job-spec.json` is missing.

### SJ002 — cron-expression-valid
`schedule` must be a valid cron expression. Supported shorthands: `@daily`, `@hourly`, `@weekly`, `@monthly`, `@yearly`, `@midnight`, `@reboot`.

For standard cron, validates field-by-field:
- Minute: 0–59
- Hour: 0–23
- Day of month: 1–31
- Month: 1–12
- Day of week: 0–7 (0 and 7 are Sunday)
- Supports `*`, ranges (`1-5`), steps (`*/5`), and lists (`1,3,5`)

BAD:
```json
{ "schedule": "60 25 * * *" }
// minute 60 and hour 25 are out of range
```
```json
{ "schedule": "every night" }
// not a valid cron expression
```
GOOD:
```json
{ "schedule": "0 2 * * *" }
{ "schedule": "@daily" }
{ "schedule": "*/15 * * * *" }
```

### SJ004 — concurrency-policy-set
`concurrencyPolicy` must be explicitly declared as one of: `Allow`, `Forbid`, `Replace`.

- `Forbid` — skip new run if previous is still running (most common for data jobs)
- `Replace` — cancel previous run and start new (for time-critical jobs)
- `Allow` — run concurrent instances (only for truly idempotent, stateless jobs)

BAD:
```json
{ "name": "report", "schedule": "0 2 * * *", "command": ["node", "run.js"], "image": "app:1.0" }
// no concurrencyPolicy — Kubernetes defaults to Allow
```
GOOD:
```json
{ "concurrencyPolicy": "Forbid" }
```

### SJ005 — limits-valid
`backoffLimit`, `successfulJobsHistoryLimit`, and `failedJobsHistoryLimit` must be non-negative integers when declared. Negative values are rejected by Kubernetes.

BAD:
```json
{ "backoffLimit": -1, "failedJobsHistoryLimit": -5 }
```
GOOD:
```json
{ "backoffLimit": 3, "successfulJobsHistoryLimit": 3, "failedJobsHistoryLimit": 5 }
```

### SJ006 — no-undeclared-secrets
Any env ref with `secret: true` must declare `secretName`. Without `secretName`, the job cannot mount the Kubernetes Secret at runtime.

BAD:
```json
{ "envRefs": [{ "name": "DB_URL", "secret": true }] }
// secret: true but no secretName
```
GOOD:
```json
{ "envRefs": [{ "name": "DB_URL", "secret": true, "secretName": "db-credentials" }] }
```

### SJ007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### SJ008 — contract-job
Final contract checks:
- `owner` must be declared — unowned scheduled jobs have no one to alert when they fail
- `concurrencyPolicy` must be declared (redundant final check)

BAD:
```json
{ "name": "report", "schedule": "0 2 * * *", "command": ["node", "run.js"], "image": "app:1.0" }
// no owner, no concurrencyPolicy
```
GOOD:
```json
{ "concurrencyPolicy": "Forbid", "owner": "data-team" }
```

---

## What This Compiler Never Forgives

- `scheduled-job-spec.json` missing (SJ001 hard-fails)
- `name`, `schedule`, `command`, or `image` missing (SJ001)
- Invalid cron expression (out-of-range fields) (SJ002)
- Unrecognized shorthand (SJ002)
- `concurrencyPolicy` not `Allow`/`Forbid`/`Replace` (SJ004)
- `concurrencyPolicy` not declared (SJ004, SJ008)
- `backoffLimit`, `successfulJobsHistoryLimit`, or `failedJobsHistoryLimit` is negative (SJ005)
- Env ref with `secret: true` but no `secretName` (SJ006)
- `owner` not declared (SJ008)
