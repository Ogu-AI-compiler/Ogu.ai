---
name: backup-policy
description: Compiler skill for the backup-policy compiler. Activates when producing backup-policy-artifact.json. Gates: DBP001–DBP006. Hard-fails when spec missing.
---

# backup-policy — Compiler Skill

## What This Compiler Does

Compiles database backup policies — validates spec structure (all required backup parameters), validates PITR window format and minimum duration, verifies that snapshot frequency meets the RPO (with PITR/WAL archiving as an exception), enforces minimum retention days per compliance tier, requires geo-redundant backup storage for production, and requires WAL archiving with a declared target when RPO is under 24 hours.

**Upstream dependency:** none
**Output artifact:** `backup-policy-artifact.json`
**IR identifier:** `BACKUP_POLICY:{project}`

---

## Spec Shape

**`backup-policy.json`**:
```json
{
  "snapshot_frequency": "6h",
  "pitr_window":        "7d",
  "retention_days":     90,
  "rpo_hours":          4,
  "rto_hours":          2,
  "geo_redundant":      true,
  "wal_archiving":      true,
  "wal_archive_target": "s3://my-bucket/wal/",
  "compliance_tier":    "soc2",
  "ha_tier":            "production"
}
```

Required fields:
- `snapshot_frequency` — string duration (e.g., `"6h"`, `"1d"`)
- `pitr_window` — string duration (e.g., `"7d"`, `"24h"`)
- `retention_days` — positive number
- `rpo_hours` — positive number
- `rto_hours` — positive number
- `geo_redundant` — boolean
- `wal_archiving` — boolean

---

## Gates

### DBP001 — spec-valid
Reads `backup-policy.json`. Hard-fails if missing. Required: `snapshot_frequency`, `pitr_window`, `retention_days`, `rpo_hours`, `rto_hours`, `geo_redundant`, `wal_archiving`. Numeric fields must be positive numbers; boolean fields must be booleans.

BAD: spec missing or `rpo_hours: "4h"` (string) or `geo_redundant: "yes"` (string).
GOOD: all seven required fields present with correct types and positive numeric values.

### DBP002 — pitr-defined
`pitr_window` must be a valid duration string (`Nd` for days or `Nh` for hours), at least 1 hour, and at least as long as `rpo_hours`. Without PITR, recovery is limited to the last full snapshot — potentially losing hours of data on failure.

BAD:
```json
{ "pitr_window": "fast" }
// Not a valid duration format
{ "pitr_window": "30m" }
// Less than 1 hour minimum
{ "pitr_window": "2h", "rpo_hours": 4 }
// PITR window (2h) shorter than RPO (4h)
```
GOOD:
```json
{ "pitr_window": "7d",  "rpo_hours": 4 }
{ "pitr_window": "24h", "rpo_hours": 4 }
```

### DBP003 — rpo-met
`snapshot_frequency` must be ≤ `rpo_hours` unless WAL archiving with PITR is configured. Without PITR, the snapshot frequency IS the worst-case data loss — a 24h snapshot interval with a 4h RPO violates the SLA.

BAD (no WAL/PITR):
```json
{
  "snapshot_frequency": "24h",
  "rpo_hours": 4,
  "wal_archiving": false
}
// 24h snapshot interval with 4h RPO — can lose up to 24h of data without WAL
```
GOOD (WAL archiving fills the gap):
```json
{
  "snapshot_frequency": "24h",
  "rpo_hours": 4,
  "wal_archiving": true,
  "wal_archive_target": "s3://bucket/wal/",
  "pitr_window": "7d"
}
```
GOOD (snapshot frequency meets RPO):
```json
{
  "snapshot_frequency": "4h",
  "rpo_hours": 4
}
```

### DBP004 — retention-compliance
`retention_days` must meet the minimum for the declared `compliance_tier`. If `compliance_tier` is absent, the baseline minimum of 7 days applies.

| Compliance tier | Minimum retention |
|-----------------|-------------------|
| baseline        | 7 days            |
| gdpr            | 30 days           |
| pci_dss         | 90 days           |
| soc2            | 90 days           |
| hipaa           | 365 days          |

BAD:
```json
{ "compliance_tier": "hipaa", "retention_days": 30 }
// 30 days < 365-day HIPAA minimum
```
GOOD:
```json
{ "compliance_tier": "hipaa", "retention_days": 365 }
{ "compliance_tier": "soc2",  "retention_days": 90  }
```

### DBP005 — geo-redundancy
For production environments (`ha_tier: "production"` or `ha_tier` not declared), `geo_redundant` must be `true`. A backup stored in the same region as the primary database is destroyed in the same regional disaster — providing no protection.

BAD:
```json
{ "geo_redundant": false, "ha_tier": "production" }
// Backup co-located with primary — useless for regional disaster recovery
```
GOOD:
```json
{ "geo_redundant": true }
// Backup stored in a different geographic region/AZ
```
Skips for non-production `ha_tier` values (e.g., `"staging"`, `"development"`).

### DBP006 — wal-archiving
When `rpo_hours < 24`, WAL archiving must be enabled (`wal_archiving: true`) and `wal_archive_target` must be declared. WAL archiving is the mechanism that enables PITR — without it, recovery is limited to full snapshot boundaries.

Also enforces: if `wal_archiving: true` is set for any RPO, `wal_archive_target` must be declared.

BAD:
```json
{ "rpo_hours": 4, "wal_archiving": false }
// 4h RPO requires WAL archiving — snapshots alone can't guarantee 4h recovery point
```
BAD:
```json
{ "wal_archiving": true }
// wal_archive_target not declared — WAL enabled but no destination configured
```
GOOD:
```json
{
  "rpo_hours": 4,
  "wal_archiving": true,
  "wal_archive_target": "s3://my-bucket/wal/"
}
```

---

## What This Compiler Never Forgives

- `backup-policy.json` missing (DBP001 hard-fails)
- Any of `snapshot_frequency`, `pitr_window`, `retention_days`, `rpo_hours`, `rto_hours`, `geo_redundant`, `wal_archiving` missing (DBP001)
- `rpo_hours`, `rto_hours`, or `retention_days` not a positive number (DBP001)
- `geo_redundant` or `wal_archiving` not a boolean (DBP001)
- `pitr_window` not a valid duration format (DBP002)
- `pitr_window` shorter than `rpo_hours` (DBP002)
- `snapshot_frequency` exceeds `rpo_hours` without WAL archiving + PITR configured (DBP003)
- `retention_days` below the compliance tier minimum (DBP004)
- `geo_redundant: false` for production environment (DBP005)
- `rpo_hours < 24` with `wal_archiving` not enabled (DBP006)
- `wal_archiving: true` without `wal_archive_target` declared (DBP006)
