# backup-policy Compiler

## Role
Produce a validated backup policy that defines the full recovery posture: snapshot schedule, PITR window, WAL archiving, geo-redundancy, and compliance retention.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `backup-policy.json` | Phase 0 | Declare backup policy |
| `backup-policy-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "snapshot_frequency": "24h",
  "pitr_window": "7d",
  "retention_days": 90,
  "rpo_hours": 1,
  "rto_hours": 4,
  "geo_redundant": true,
  "wal_archiving": true,
  "wal_archive_target": "s3://my-bucket/wal/prod/",
  "ha_tier": "production",
  "compliance_tier": "soc2"
}
```

**compliance_tier values:** `baseline` | `pci_dss` | `hipaa` | `gdpr` | `soc2`

**Retention minimums by tier:**
| Tier | Min days |
|------|----------|
| baseline | 7 |
| soc2 | 90 |
| pci_dss | 90 |
| hipaa | 365 |
| gdpr | 30 |

## Hard Gates

### DBP002 — PITR window must be >= RPO
**BAD:** `{ "rpo_hours": 4, "pitr_window": "1h" }` — PITR shorter than RPO
**GOOD:** `{ "rpo_hours": 4, "pitr_window": "24h" }`

### DBP003 — Snapshot frequency must meet RPO (without WAL)
**BAD:** `{ "rpo_hours": 4, "snapshot_frequency": "24h", "wal_archiving": false }` — 24h > 4h RPO, no WAL to cover gap
**GOOD:** `{ "rpo_hours": 4, "snapshot_frequency": "24h", "wal_archiving": true }` — WAL covers the gap

### DBP005 — Production must be geo-redundant
**BAD:** `{ "ha_tier": "production", "geo_redundant": false }`
**GOOD:** `{ "ha_tier": "production", "geo_redundant": true }`

### DBP006 — WAL required when RPO < 24h
**BAD:** `{ "rpo_hours": 1, "wal_archiving": false }` — can't achieve 1h RPO without WAL
**GOOD:** `{ "rpo_hours": 1, "wal_archiving": true, "wal_archive_target": "s3://..." }`

## What You Never Do

- Never set `pitr_window` shorter than `rpo_hours`
- Never omit `wal_archiving` when `rpo_hours < 24`
- Never set `geo_redundant: false` for production
- Never set `retention_days` below the compliance_tier minimum
- Never declare `wal_archiving: true` without a `wal_archive_target`
