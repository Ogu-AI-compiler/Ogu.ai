---
name: restore-verification-spec
description: Compiler skill for the restore-verification-spec compiler. Activates when producing restore-verification-artifact.json. Gates: RVS001–RVS005 + no-todos. No upstream dependency.
---

# restore-verification-spec — Compiler Skill

## What This Compiler Does

Compiles the database restore verification specification — RTO target, integrity checks, automated drill schedule, and checksum method. Enforces: RTO is a concrete number (not "fast"), RTO is tighter than the SLA if declared, at least one row-count integrity check exists, drill schedule is automated at monthly minimum, and checksum method is a recognized verification technique.

**Upstream dependency:** none
**Output artifact:** `restore-verification-artifact.json`
**IR identifier:** `RESTORE_VERIFICATION:{project}`

---

## Spec Shape

```json
{
  "rto_hours": 4,
  "rto_sla_hours": 8,
  "rpo_hours": 1,
  "integrity_checks": [
    { "table": "users", "check_type": "row_count" },
    { "table": "orders", "check_type": "row_count" },
    { "table": "payments", "check_type": "checksum" }
  ],
  "checksum_method": "pg_dump_sha256",
  "drill_schedule": {
    "frequency": "monthly",
    "automated": true
  }
}
```

Required fields:
- `rto_hours` — positive number (Recovery Time Objective in hours)
- `drill_schedule` — object with `frequency` and `automated`
- `integrity_checks` — non-empty array
- `checksum_method` — recognized verification method string

---

## Gates

### RVS001 — spec-valid
Reads `restore-verification-spec.json`. Required: `rto_hours` (positive number), `drill_schedule`, `integrity_checks` (non-empty array), `checksum_method` (non-empty string).

Hard-fails if `restore-verification-spec.json` is missing.

### RVS002 — rto-quantitative
`rto_hours` must be a concrete positive number — not a vague description. If `rto_sla_hours` is declared, `rto_hours` must be strictly less than it (technical target must be tighter than the SLA).

BAD:
```json
{ "rto_hours": "fast" }
{ "rto_hours": "acceptable" }
```
```json
{ "rto_hours": 8, "rto_sla_hours": 8 }
// rto_hours must be < rto_sla_hours, not equal
```
GOOD:
```json
{ "rto_hours": 4, "rto_sla_hours": 8 }
// technical RTO = 4h < SLA = 8h
```

### RVS003 — integrity-checks
`integrity_checks` must be a non-empty array. Each check requires:
- `table` — table name
- `check_type` — `"row_count"`, `"checksum"`, `"sample_query"`, or `"count_compare"`

At least one check must be `"row_count"` or `"count_compare"` — without a row count check, a partial restore (missing rows) is indistinguishable from a full restore.

BAD:
```json
{ "integrity_checks": [] }
// empty
```
```json
{ "integrity_checks": [{ "table": "users", "check_type": "checksum" }] }
// no row_count check — partial restore undetectable
```
GOOD:
```json
{ "integrity_checks": [
  { "table": "users", "check_type": "row_count" },
  { "table": "orders", "check_type": "checksum" }
]}
```

### RVS004 — drill-schedule
`drill_schedule` must declare:
- `frequency` — `"daily"`, `"weekly"`, `"monthly"` (minimum for production; `"quarterly"` is not acceptable)
- `automated: true` — manual drills are unreliable and often skipped

Additional rule: if `rpo_hours < 4`, `frequency` must be at least `"weekly"`.

BAD:
```json
{ "drill_schedule": { "frequency": "quarterly", "automated": true } }
// quarterly too infrequent for production
```
```json
{ "drill_schedule": { "frequency": "monthly", "automated": false } }
// manual drill — not reliable
```
GOOD:
```json
{ "drill_schedule": { "frequency": "monthly", "automated": true } }
```

### RVS005 — checksum-method
`checksum_method` must be a recognized, machine-verifiable method:
- `pg_dump_md5` — MD5 of pg_dump output
- `pg_dump_sha256` — SHA256 of pg_dump output (preferred)
- `table_count` — row count comparison
- `table_checksum` — PostgreSQL pg_catalog checksum
- `pitr_lsn` — WAL LSN position comparison for PITR
- `custom` — requires `checksum_method_description`

Vague methods blocked: `"manual"`, `"visual"`, `"check"`, `"verify"`, `"tbd"`, `"none"`.

BAD:
```json
{ "checksum_method": "manual" }
{ "checksum_method": "visual inspection" }
```
GOOD:
```json
{ "checksum_method": "pg_dump_sha256" }
{ "checksum_method": "custom", "checksum_method_description": "Row hash comparison via custom pg extension" }
```

---

## What This Compiler Never Forgives

- `restore-verification-spec.json` missing (RVS001 hard-fails)
- `rto_hours`, `drill_schedule`, `integrity_checks`, or `checksum_method` missing (RVS001)
- `integrity_checks` empty (RVS001)
- `rto_hours` is a vague string (RVS002)
- `rto_hours` ≥ `rto_sla_hours` when both declared (RVS002)
- `integrity_checks` has no `row_count` or `count_compare` check (RVS003)
- `check_type` not in valid list (RVS003)
- `drill_schedule.frequency` is `"quarterly"` (RVS004)
- `drill_schedule.automated` not `true` (RVS004)
- `rpo_hours < 4` with `frequency: "monthly"` (RVS004)
- `checksum_method` is a vague string (RVS005)
- `checksum_method: "custom"` without `checksum_method_description` (RVS005)
