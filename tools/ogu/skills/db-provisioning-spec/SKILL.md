---
name: db-provisioning-spec
description: Compiler skill for the db-provisioning-spec compiler. Activates when producing db-provisioning-artifact.json. Gates: DPS001–DPS007. No upstream dependency.
---

# db-provisioning-spec — Compiler Skill

## What This Compiler Does

Compiles the PostgreSQL database provisioning specification — platform, engine version, instance class, storage type, HA configuration, backup retention, encryption, and deletion protection. Enforces: engine version is not EOL (≥12), PII instances must encrypt at rest, production requires `deletion_protection: true` and `multi_az: true`, backup retention meets tier minimums, and storage type matches IOPS requirements.

**Upstream dependency:** none
**Output artifact:** `db-provisioning-artifact.json`
**IR identifier:** `DB_PROVISIONING:{project}`

---

## Spec Shape

```json
{
  "platform": "aws-rds",
  "engine": "postgres",
  "engine_version": "16.2",
  "instance_class": "db.t3.medium",
  "storage_type": "gp3",
  "storage_size_gb": 100,
  "multi_az": true,
  "deletion_protection": true,
  "encryption_at_rest": true,
  "backup_retention_days": 14,
  "ha_tier": "production",
  "pii": true
}
```

Required fields:
- `platform` — `aws-rds`, `gcp-cloud-sql`, `azure-database`, `supabase`, `neon`, or `self-hosted`
- `engine` — must be `"postgres"`
- `engine_version` — version string (e.g., `"16.2"`)
- `instance_class` — instance/machine type
- `storage_type` — `gp2`, `gp3`, `io1`, `io2`, `magnetic`, `ssd`, or `serverless`
- `storage_size_gb` — positive number
- `multi_az` — boolean
- `deletion_protection` — boolean
- `encryption_at_rest` — boolean
- `backup_retention_days` — non-negative number
- `ha_tier` — `"development"`, `"staging"`, or `"production"`

---

## Gates

### DPS001 — spec-valid
Reads `db-provisioning-spec.json`. Required: all 11 fields above. `engine` must be `"postgres"`. `platform` and `storage_type` must be valid values. `ha_tier` must be `development`, `staging`, or `production`.

Hard-fails if `db-provisioning-spec.json` is missing.

### DPS002 — engine-version
`engine_version` must be a supported PostgreSQL major version (≥12). PostgreSQL 11 and below are EOL — no security patches.

EOL versions (rejected): 9, 10, 11.
Supported minimum: 12.

BAD:
```json
{ "engine_version": "11.19" }
// PostgreSQL 11 is EOL
```
```json
{ "engine_version": "9.6" }
// PostgreSQL 9 is EOL
```
GOOD:
```json
{ "engine_version": "16.2" }
{ "engine_version": "15" }
```

### DPS003 — encryption-at-rest
Skipped if `spec.pii` is not `true`. When `pii: true`, `encryption_at_rest` must be `true`. Unencrypted PII storage violates GDPR Article 25 and HIPAA §164.312(a)(2)(iv).

BAD:
```json
{ "pii": true, "encryption_at_rest": false }
```
GOOD:
```json
{ "pii": true, "encryption_at_rest": true }
```

### DPS004 — deletion-protection
Skipped for non-production tiers. When `ha_tier: "production"`, `deletion_protection` must be `true`. A single CLI command can permanently destroy an unprotected database.

BAD:
```json
{ "ha_tier": "production", "deletion_protection": false }
```
GOOD:
```json
{ "ha_tier": "production", "deletion_protection": true }
```

### DPS005 — multi-az
Skipped for non-production tiers. When `ha_tier: "production"`, `multi_az` must be `true`. Single-AZ production databases have a single point of failure — any AZ outage causes downtime until manual failover.

BAD:
```json
{ "ha_tier": "production", "multi_az": false }
```
GOOD:
```json
{ "ha_tier": "production", "multi_az": true }
```

### DPS006 — backup-retention
Minimum `backup_retention_days` by tier:
- `production` — ≥ 7 days (SOC2/PCI-DSS baseline)
- `staging` — ≥ 1 day
- `development` — any value (including 0)

BAD:
```json
{ "ha_tier": "production", "backup_retention_days": 3 }
// below 7-day minimum for production
```
GOOD:
```json
{ "ha_tier": "production", "backup_retention_days": 14 }
```

### DPS007 — storage-type
- `provisioned_iops` declared → `storage_type` must be `io1` or `io2`
- `gp2` or `magnetic` on `ha_tier: "production"` is flagged as legacy (prefer `gp3`)
- `serverless` storage type + `provisioned_iops` is a contradiction

BAD:
```json
{ "storage_type": "gp3", "provisioned_iops": 3000 }
// gp3 cannot provision IOPS — use io1 or io2
```
```json
{ "ha_tier": "production", "storage_type": "gp2" }
// legacy type for production — prefer gp3
```
GOOD:
```json
{ "storage_type": "io2", "provisioned_iops": 3000 }
{ "storage_type": "gp3" }
```

---

## What This Compiler Never Forgives

- `db-provisioning-spec.json` missing (DPS001 hard-fails)
- Any of the 11 required fields missing (DPS001)
- `engine` not `"postgres"` (DPS001)
- `platform`, `storage_type`, or `ha_tier` not in valid list (DPS001)
- PostgreSQL major version ≤ 11 (EOL) (DPS002)
- `pii: true` without `encryption_at_rest: true` (DPS003)
- `ha_tier: "production"` without `deletion_protection: true` (DPS004)
- `ha_tier: "production"` without `multi_az: true` (DPS005)
- `ha_tier: "production"` with `backup_retention_days < 7` (DPS006)
- `ha_tier: "staging"` with `backup_retention_days < 1` (DPS006)
- `provisioned_iops` declared with non-io1/io2 storage type (DPS007)
