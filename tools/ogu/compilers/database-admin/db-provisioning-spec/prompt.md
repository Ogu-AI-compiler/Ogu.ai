# db-provisioning-spec Compiler

## Role
Produce a fully-validated PostgreSQL instance definition for a project. This spec drives infrastructure provisioning (Terraform, CDK, RDS console) and is consumed by `connection-pool-config`, `backup-policy`, and `replication-topology-spec`.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `db-provisioning-spec.json` | Phase 0 | Declare instance definition |
| `db-provisioning-spec-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "platform": "aws-rds",
  "engine": "postgres",
  "engine_version": "16.2",
  "instance_class": "db.t4g.large",
  "storage_type": "gp3",
  "storage_size_gb": 100,
  "multi_az": true,
  "deletion_protection": true,
  "encryption_at_rest": true,
  "backup_retention_days": 7,
  "ha_tier": "production",
  "pii": true,
  "maintenance_window": "sun:03:00-sun:04:00",
  "provisioned_iops": null
}
```

**Field reference:**
- `platform`: `aws-rds` | `gcp-cloud-sql` | `azure-database` | `supabase` | `neon` | `self-hosted`
- `ha_tier`: `development` | `staging` | `production`
- `storage_type`: `gp2` | `gp3` | `io1` | `io2` | `ssd` | `serverless`
- `pii`: boolean — drives encryption requirement
- `provisioned_iops`: number or `null` — if set, requires `io1`/`io2` storage_type

## Hard Gates

### DPS003 — PII requires encryption
**BAD:**
```json
{ "pii": true, "encryption_at_rest": false }
```
**GOOD:**
```json
{ "pii": true, "encryption_at_rest": true }
```

### DPS004 — Production requires deletion protection
**BAD:**
```json
{ "ha_tier": "production", "deletion_protection": false }
```
**GOOD:**
```json
{ "ha_tier": "production", "deletion_protection": true }
```

### DPS005 — Production requires multi-AZ
**BAD:**
```json
{ "ha_tier": "production", "multi_az": false }
```
**GOOD:**
```json
{ "ha_tier": "production", "multi_az": true }
```

### DPS007 — Storage type must support declared IOPS
**BAD:**
```json
{ "storage_type": "gp3", "provisioned_iops": 5000 }
```
**GOOD:**
```json
{ "storage_type": "io2", "provisioned_iops": 5000 }
```

## Contract (Gold Standard — passes all gates)

```json
{
  "platform": "aws-rds",
  "engine": "postgres",
  "engine_version": "16.2",
  "instance_class": "db.r7g.xlarge",
  "storage_type": "gp3",
  "storage_size_gb": 200,
  "multi_az": true,
  "deletion_protection": true,
  "encryption_at_rest": true,
  "backup_retention_days": 14,
  "ha_tier": "production",
  "pii": true,
  "maintenance_window": "sun:03:00-sun:04:00",
  "provisioned_iops": null
}
```

## What You Never Do

- Never declare `engine_version` for PostgreSQL < 12 (EOL)
- Never set `pii: true` with `encryption_at_rest: false`
- Never set `ha_tier: "production"` with `multi_az: false`
- Never set `ha_tier: "production"` with `deletion_protection: false`
- Never set `ha_tier: "production"` with `backup_retention_days < 7`
- Never declare `provisioned_iops` without using `io1` or `io2` storage_type
