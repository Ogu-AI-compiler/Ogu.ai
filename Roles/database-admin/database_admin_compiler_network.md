# Database Administrator Compiler Network
> Domain Compiler Network — Database Administrator Role Decomposition
> Generated for: formal compiler network build planning
> Stack assumptions: PostgreSQL, PgBouncer, Prisma/Drizzle at application layer, Redis where relevant
> Excludes already-built and shared/cross-role compilers

---

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `db-provisioning-spec` | per-project | Platform config, instance class requirements, HA requirements | `db-provisioning-spec.json` |
| `instance-sizing-policy` | per-project | Workload profile, growth forecast, query class inventory | `instance-sizing-policy.json` |
| `connection-pool-config` | per-project | Service inventory, concurrency requirements, pool mode | `connection-pool-config.json` |
| `connection-string-contract` | per-project | Provisioning spec, pool config, environment list | `connection-string-contract.json` |
| `role-privilege-policy` | per-project | Service accounts, data classification, schema ownership | `role-privilege-policy.json` |
| `db-user-provisioning-manifest` | per-feature | Role policy, service identity, environment list | `db-user-manifest.json` |
| `schema-ownership-policy` | per-project | Schema list, team ownership, migration policy | `schema-ownership-policy.json` |
| `index-advisory-spec` | per-feature | Query patterns, table stats, cardinality estimates | `index-advisory-spec.json` |
| `partitioning-strategy-spec` | per-project | Table list, row growth forecast, query access patterns | `partitioning-strategy-spec.json` |
| `retention-archival-policy` | per-project | Data classification, compliance requirements, storage model | `retention-archival-policy.json` |
| `backup-policy` | per-project | Instance spec, RPO/RTO requirements, environment list | `backup-policy.json` |
| `restore-verification-spec` | per-project | Backup policy, restore targets, verification steps | `restore-verification-spec.json` |
| `replication-topology-spec` | per-project | Instance list, HA requirements, replication lag thresholds | `replication-topology-spec.json` |
| `read-replica-routing-policy` | per-project | Replica topology, query class list, staleness tolerance | `read-replica-routing-policy.json` |
| `failover-policy` | per-project | Replication topology, RPO/RTO, health check thresholds | `failover-policy.json` |
| `timeout-policy` | per-project | Workload class list, transaction profile, client SLA | `timeout-policy.json` |
| `query-performance-budget` | per-feature | Query patterns, SLA, workload class, index advisory | `query-perf-budget.json` |
| `slow-query-analysis-spec` | daily | Query log threshold, normalization rules, triage policy | `slow-query-analysis-spec.json` |
| `vacuum-maintenance-policy` | per-project | Table bloat thresholds, autovacuum config, maintenance windows | `vacuum-policy.json` |
| `statistics-refresh-policy` | per-project | Table list, update frequency, analyze trigger rules | `statistics-refresh-policy.json` |
| `storage-growth-policy` | per-project | Current storage, growth rate, alert thresholds | `storage-growth-policy.json` |
| `capacity-forecast` | per-project | Storage growth policy, instance sizing, query budget | `capacity-forecast.json` |
| `seed-bootstrap-data-policy` | per-project | Data model, environment list, PII classification | `seed-data-policy.json` |
| `data-masking-policy` | per-project | PII classification, environment list, masking strategy | `data-masking-policy.json` |
| `db-audit-log-policy` | per-project | Role policy, compliance requirements, event taxonomy | `db-audit-log-policy.json` |
| `migration-execution-policy` | per-project | Migration artifacts, lock policies, traffic constraints | `migration-exec-policy.json` |
| `data-integrity-validation-spec` | per-feature | Schema, referential integrity rules, constraint inventory | `data-integrity-spec.json` |
| `db-health-check-spec` | per-project | Instance list, metric thresholds, readiness criteria | `db-health-check-spec.json` |
| `materialized-view-refresh-policy` | per-feature | View list, staleness tolerance, dependency graph | `matview-refresh-policy.json` |
| `multi-tenant-isolation-spec` | per-project | Tenant model, isolation strategy, schema/row-level rules | `tenant-isolation-spec.json` |
| `disaster-recovery-spec` | per-project | Backup policy, failover policy, RTO/RPO targets | `dr-spec.json` |
| `restore-drill-report` | per-incident | Restore-verification-spec, backup artifacts, DR spec | `restore-drill-report.json` |
| `lock-contention-policy` | per-project | Transaction profile, migration exec policy, lock timeout | `lock-contention-policy.json` |
| `job-scheduling-policy` | per-project | Maintenance tasks, maintenance windows, dependency graph | `job-scheduling-policy.json` |
| `schema-drift-report` | daily | Schema from all environments, canonical migration state | `schema-drift-report.json` |

---

## Detailed Breakdown

---

### 1. `db-provisioning-spec`

**Frequency:** per-project

**Input:**
- Cloud/managed platform (AWS RDS, Supabase, Neon, self-hosted, etc.)
- Instance class requirements (CPU, RAM, IOPS)
- High-availability requirements (single / multi-AZ / multi-region)
- PostgreSQL version
- Storage type (SSD, provisioned IOPS, serverless)
- Network placement (VPC, subnet, security group references)

**Output:**
- `db-provisioning-spec.json` — instance definition: platform, engine version, instance class, storage type, storage size, multi-AZ flag, parameter group references, maintenance window, deletion protection flag, encryption-at-rest flag, backup retention days

**Spec file:** `db-provisioning-spec.spec.json`
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
  "backup_retention_days": 7
}
```

**Correctness Gates:**
1. `engine_version` is a supported, non-EOL PostgreSQL version
2. `encryption_at_rest: true` for any environment with `pii: true` classification
3. `deletion_protection: true` for all production instances
4. `multi_az: true` for any instance with `ha_tier: production`
5. `backup_retention_days` ≥ 7 for production (or ≥ compliance minimum)
6. `maintenance_window` is defined and does not overlap with declared peak traffic windows
7. Storage type is appropriate for declared IOPS requirements (gp2 flagged if provisioned IOPS declared)

**Error Codes:**
- `DBA001` — Engine version is EOL or unsupported
- `DBA002` — PII-tier instance missing encryption-at-rest
- `DBA003` — Production instance missing deletion protection
- `DBA004` — Production HA instance missing multi-AZ
- `DBA005` — Backup retention below compliance minimum

**Key Invariant:** Compiler must fail if any instance classified as `ha_tier: production` has `multi_az: false`.

**Safe Default:** Without a provisioning spec, instances are created with platform defaults, which often disable encryption, deletion protection, and multi-AZ.

**Dependencies:**
- Platform/infra definitions (external input)
- `data-masking-policy.json` (to set `pii` classification flag)

**Downstream Consumers:**
- `instance-sizing-policy`
- `connection-pool-config`
- `backup-policy`
- `replication-topology-spec`
- `disaster-recovery-spec`

---

### 2. `instance-sizing-policy`

**Frequency:** per-project

**Input:**
- Workload profile (OLTP / OLAP / mixed, query class distribution)
- Concurrent connection estimate
- Peak QPS estimate
- Data size current and 12-month forecast
- Query performance budget

**Output:**
- `instance-sizing-policy.json` — sizing rules: min/recommended/max instance class per environment tier, RAM:connections ratio, CPU threshold for scale-up trigger, IOPS reservation, read replica triggers (when to add a replica), instance class upgrade criteria

**Spec file:** `instance-sizing-policy.spec.json`

**Correctness Gates:**
1. Recommended instance RAM ≥ (active working set size estimate × 1.25)
2. Max connections for instance class ≥ declared peak concurrent connection estimate
3. Scale-up CPU threshold is a specific percentage (not "high")
4. Read replica trigger is a quantitative threshold (replication lag / read QPS, not vague)
5. Every environment tier (dev / staging / prod) has a distinct class entry
6. IOPS reservation is defined for provisioned IOPS storage types

**Error Codes:**
- `DBA010` — Instance RAM insufficient for working set estimate
- `DBA011` — Max connections below peak concurrent connection estimate
- `DBA012` — Scale-up trigger is non-quantitative
- `DBA013` — Environment tier missing sizing entry
- `DBA014` — IOPS reservation undefined for provisioned IOPS storage

**Key Invariant:** Compiler must fail if the instance max_connections for any tier is less than the declared peak concurrent connection estimate for that tier.

**Safe Default:** Without instance-sizing-policy, instances are over- or under-provisioned based on guesswork, causing OOM failures or wasted spend.

**Dependencies:**
- `db-provisioning-spec.json`
- `query-performance-budget.json` (soft dependency)

**Downstream Consumers:**
- `connection-pool-config`
- `capacity-forecast`
- `replication-topology-spec`

---

### 3. `connection-pool-config`

**Frequency:** per-project

**Input:**
- Service inventory (list of backend services, their connection requirements)
- Pool mode requirements (`session` / `transaction` / `statement`)
- Instance max_connections from `instance-sizing-policy`
- PgBouncer version and deployment model
- Authentication method (scram-sha-256, md5, peer)

**Output:**
- `connection-pool-config.json` — PgBouncer (or equivalent) configuration: pool mode, pool size per database/user pair, max client connections, min pool size, server idle timeout, client idle timeout, reserve pool size, authentication method, health check query, stats user config

**Spec file:** `connection-pool-config.spec.json`

**Correctness Gates:**
1. `pool_mode` is one of: `session` | `transaction` | `statement`
2. Sum of all pool sizes ≤ (instance `max_connections` − reserved system connections)
3. `max_client_connections` > sum of all pool sizes (clients can queue, not hard-fail)
4. `server_idle_timeout` is defined and > 0
5. `auth_type` is `scram-sha-256` (md5 flagged as deprecated)
6. `health_check_query` is defined and is a valid SQL expression
7. `reserve_pool_size` > 0 (for emergency connections)
8. Cross-compiler: pool user list matches service accounts declared in `db-user-manifest.json`

**Error Codes:**
- `DBA020` — Total pool sizes exceed instance max_connections
- `DBA021` — Auth type is md5 (deprecated, flagged)
- `DBA022` — Health check query undefined
- `DBA023` — Reserve pool size is zero
- `DBA024` — Pool user not found in db-user-manifest

**Key Invariant:** Compiler must fail if the sum of all configured pool sizes exceeds `instance max_connections` minus reserved system connections.

**Safe Default:** Without connection-pool-config, services connect directly to PostgreSQL, exhausting max_connections under load and causing connection refused errors.

**Dependencies:**
- `instance-sizing-policy.json`
- `db-user-provisioning-manifest.json`

**Downstream Consumers:**
- `connection-string-contract`
- `timeout-policy`
- `db-health-check-spec`

---

### 4. `connection-string-contract`

**Frequency:** per-project

**Input:**
- `connection-pool-config.json`
- `db-provisioning-spec.json`
- Environment list (local, dev, staging, prod)
- Service identity list

**Output:**
- `connection-string-contract.json` — per-environment, per-service connection contract: host template (vault reference, not literal), port, database name, pool mode, SSL mode, connection string format (URI vs DSN), max_connections override, timeout parameters

**Spec file:** `connection-string-contract.spec.json`

**Correctness Gates:**
1. No connection string contains a literal password (must reference a vault path or environment variable placeholder)
2. `sslmode` is `require` or `verify-full` for all non-local environments
3. Every environment has a host entry defined
4. Every service has a separate connection string entry (no shared connection strings across services)
5. Connection string format is consistent across all entries (all URI or all DSN)
6. Cross-compiler: every service listed here matches a service in `db-user-manifest.json`
7. `connect_timeout` is defined (not absent)

**Error Codes:**
- `DBA030` — Literal password detected in connection string
- `DBA031` — sslmode is not require/verify-full for non-local environment
- `DBA032` — Environment missing host entry
- `DBA033` — Service shares connection string with another service
- `DBA034` — connect_timeout not defined

**Key Invariant:** Compiler must fail if any connection string contains a literal credential value instead of a vault or environment variable reference.

**Safe Default:** Without connection-string-contract, services use ad-hoc connection strings with inconsistent SSL modes, timeouts, and shared credentials.

**Dependencies:**
- `connection-pool-config.json`
- `db-provisioning-spec.json`
- `db-user-provisioning-manifest.json`

**Downstream Consumers:**
- Application service deployments
- `db-health-check-spec`

---

### 5. `role-privilege-policy`

**Frequency:** per-project

**Input:**
- Service account list (application services, analytics, migrations, read replicas)
- Data classification (from security `pii-classification-policy`)
- Schema list
- Table list with sensitivity tiers
- Principle of least privilege requirements

**Output:**
- `role-privilege-policy.json` — per-role privilege declarations: role name, schema access (USAGE / CREATE), table-level privileges (SELECT / INSERT / UPDATE / DELETE / TRUNCATE), sequence access, function execution rights, superuser flag (must be false for app roles), row-level security requirements

**Spec file:** `role-privilege-policy.spec.json`

**Correctness Gates:**
1. No application service role has `superuser: true`
2. No application service role has `TRUNCATE` or `DROP` privileges on production tables
3. Migration roles have `CREATE` and `ALTER` privileges; application roles do not
4. Read-only analytics roles have `SELECT` only (no INSERT/UPDATE/DELETE)
5. Every role that accesses PII-tier tables has `row_level_security: required` flag
6. No role has `ALL PRIVILEGES` wildcard (explicit privilege list only)
7. Cross-compiler: role names map to identities in `authz-policy` (security compiler) where service accounts are declared

**Error Codes:**
- `DBA040` — Application role has superuser flag
- `DBA041` — Application role has TRUNCATE or DROP privilege
- `DBA042` — Role uses ALL PRIVILEGES wildcard
- `DBA043` — PII-tier table accessible without row-level security flag
- `DBA044` — Role name not in db-user-manifest

**Key Invariant:** Compiler must fail if any application service role has `superuser: true` or any DDL privilege (DROP, TRUNCATE, ALTER) on production tables.

**Safe Default:** Without role-privilege-policy, application roles accumulate privileges informally, violating least-privilege and creating data exfiltration risk.

**Dependencies:**
- `pii-classification-policy` (security compiler)
- `schema-ownership-policy.json`

**Downstream Consumers:**
- `db-user-provisioning-manifest`
- `db-audit-log-policy`
- `multi-tenant-isolation-spec`
- `connection-pool-config`

---

### 6. `db-user-provisioning-manifest`

**Frequency:** per-feature

**Input:**
- `role-privilege-policy.json`
- Service identity list (from service deployment config)
- Environment list
- Password policy (rotation period, vault reference)

**Output:**
- `db-user-manifest.json` — per-environment, per-service user declarations: username, role assignments, allowed databases, password vault reference, connection limit, statement timeout, lock timeout, search_path setting

**Spec file:** `db-user-manifest.spec.json`

**Correctness Gates:**
1. Every user entry references a role defined in `role-privilege-policy`
2. Password is a vault reference (not a literal value)
3. `connection_limit` is defined and > 0 for every user
4. `statement_timeout` is defined for every application user
5. `search_path` is explicitly set (not relying on default `public`)
6. Users are not shared across services (one user per service per environment)
7. `superuser: false` is explicit for every application user

**Error Codes:**
- `DBA050` — User password is literal value (must be vault reference)
- `DBA051` — User references undefined role
- `DBA052` — Connection limit not defined
- `DBA053` — Statement timeout not defined for application user
- `DBA054` — search_path not explicitly set

**Key Invariant:** Compiler must fail if any user's password value is not a vault path or environment variable reference.

**Safe Default:** Without db-user-manifest, users are created ad-hoc without consistent role assignments, timeouts, or connection limits.

**Dependencies:**
- `role-privilege-policy.json`
- `secret-handling-policy` (security compiler — for vault references)

**Downstream Consumers:**
- `connection-pool-config`
- `connection-string-contract`
- `db-audit-log-policy`

---

### 7. `schema-ownership-policy`

**Frequency:** per-project

**Input:**
- Schema list
- Team/service ownership map
- Migration policy boundaries
- Multi-tenant schema strategy (if applicable)

**Output:**
- `schema-ownership-policy.json` — per-schema ownership declaration: schema name, owner role, allowed migration authors (service identity or team), object creation policy (owner-only / role-group), cross-schema access rules, search_path isolation rules

**Spec file:** `schema-ownership-policy.spec.json`

**Correctness Gates:**
1. Every schema has exactly one owner role defined
2. Owner role is not a superuser or shared application role
3. Cross-schema access is explicitly enumerated (not implicitly allowed)
4. `public` schema is either locked down or explicitly designated as shared
5. Migration author list is non-empty for every schema
6. Every schema has a `search_path_isolation: true | false` declaration

**Error Codes:**
- `DBA060` — Schema has no owner defined
- `DBA061` — Schema owner is a superuser role
- `DBA062` — Cross-schema access not explicitly declared
- `DBA063` — public schema not explicitly addressed
- `DBA064` — Migration author list is empty

**Key Invariant:** Compiler must fail if any schema has no owner role defined.

**Safe Default:** Without schema-ownership-policy, schemas are owned by the migration runner or superuser, creating ownership ambiguity and cross-team access conflicts.

**Dependencies:**
- `role-privilege-policy.json`

**Downstream Consumers:**
- `db-user-provisioning-manifest`
- `migration-execution-policy`
- `multi-tenant-isolation-spec`

---

### 8. `index-advisory-spec`

**Frequency:** per-feature

**Input:**
- Query patterns (from API route analysis or provided query list)
- Table schemas with cardinality estimates
- Current index inventory
- Query plan analysis output (EXPLAIN output, if available)
- `query-performance-budget.json`

**Output:**
- `index-advisory-spec.json` — index recommendations: table, column list, index type (btree/hash/gin/gist/brin), include columns, partial index condition (if any), estimated benefit (selectivity score), current status (recommended/existing/redundant/unused), creation priority, size estimate

**Spec file:** `index-advisory-spec.spec.json`

**Correctness Gates:**
1. Every recommended index has a specific table and column list (no vague "index this table")
2. Index type is one of the valid PostgreSQL types: `btree` | `hash` | `gin` | `gist` | `brin` | `spgist`
3. Every index recommendation references at least one query pattern that benefits from it
4. Redundant index entries (duplicate coverage) are flagged explicitly
5. Unused index entries are flagged with an age threshold (e.g., not used in 30 days)
6. Index size estimate is defined for recommendations on tables > 100MB
7. Cross-compiler: query patterns should map to known `api-route` or declared query patterns where available

**Error Codes:**
- `DBA070` — Index recommendation missing column list
- `DBA071` — Index type is invalid or unsupported
- `DBA072` — Recommended index has no benefiting query reference
- `DBA073` — Redundant index not flagged
- `DBA074` — Unused index not flagged with age threshold

**Key Invariant:** Compiler must fail if any index recommendation does not reference at least one query pattern that it benefits.

**Safe Default:** Without index-advisory-spec, index decisions are ad-hoc, resulting in missing indexes on hot query paths and bloated unused indexes.

**Dependencies:**
- `query-performance-budget.json`
- `schema-ownership-policy.json`
- Query pattern input (from `openapi-spec` or route analysis)

**Downstream Consumers:**
- `query-performance-budget`
- `vacuum-maintenance-policy` (index bloat consideration)
- `migration-execution-policy` (index creation strategy)
- `db-health-check-spec`

---

### 9. `partitioning-strategy-spec`

**Frequency:** per-project

**Input:**
- Table list with row count forecasts
- Query access patterns (partition key candidates)
- Retention and archival requirements
- `db-migration` artifact list (for compatibility check)

**Output:**
- `partitioning-strategy-spec.json` — per-table partitioning definition: table name, partitioning method (range/list/hash), partition key column, partition interval or bucket count, partition naming convention, default partition flag, sub-partitioning rules, archival partition strategy, attach/detach policy

**Spec file:** `partitioning-strategy-spec.spec.json`

**Correctness Gates:**
1. Every partitioned table has a declared `partition_key` column
2. Partitioning method is one of: `range` | `list` | `hash`
3. Range partitions have an `interval` defined (e.g., `1 month`, `1 week`)
4. Default partition flag is explicitly declared (`default_partition: true | false`)
5. Partition key column exists in the table schema (verified against migration artifacts)
6. Archival partition strategy is defined for range-partitioned tables with retention policy
7. Cross-compiler: partition key column must not be nullable unless explicitly justified with an exception record
8. Sub-partitioning, if declared, has a second-level key defined

**Error Codes:**
- `DBA080` — Partitioned table missing partition key declaration
- `DBA081` — Partition method is invalid
- `DBA082` — Range partition missing interval definition
- `DBA083` — Partition key column is nullable with no exception record
- `DBA084` — Default partition not explicitly declared

**Key Invariant:** Compiler must fail if any partitioned table's partition key column is not present in the corresponding migration artifact schema.

**Safe Default:** Without partitioning-strategy-spec, large tables grow without partition boundaries, making archival, vacuum, and range queries increasingly expensive.

**Dependencies:**
- `retention-archival-policy.json`
- `db-migration` (already built — cross-check only)
- `schema-ownership-policy.json`

**Downstream Consumers:**
- `vacuum-maintenance-policy`
- `storage-growth-policy`
- `migration-execution-policy`

---

### 10. `retention-archival-policy`

**Frequency:** per-project

**Input:**
- Data classification (PII tiers, compliance requirements)
- Table list with business retention requirements
- Archival destination (cold storage, separate schema, separate DB)
- Compliance jurisdiction requirements (GDPR, CCPA, HIPAA)

**Output:**
- `retention-archival-policy.json` — per-table retention rules: table name, retention period, archival trigger (age / size / row count), archival destination, deletion method (soft-delete / hard-delete / anonymize), PII deletion verification requirement, legal hold override mechanism

**Spec file:** `retention-archival-policy.spec.json`

**Correctness Gates:**
1. Every table with a PII classification has a retention period defined
2. Retention period is a specific duration (not "as long as needed")
3. Deletion method is one of: `soft-delete` | `hard-delete` | `anonymize`
4. PII-tier tables with `hard-delete` have a deletion verification step defined
5. Legal hold override mechanism is declared (cannot silently prevent deletion)
6. Archival destination is defined for tables with archival trigger
7. Retention period does not conflict with compliance minimum for declared jurisdiction

**Error Codes:**
- `DBA090` — PII table missing retention period
- `DBA091` — Retention period is non-specific
- `DBA092` — PII hard-delete missing verification step
- `DBA093` — Archival trigger defined but destination undefined
- `DBA094` — Retention period below compliance minimum for jurisdiction

**Key Invariant:** Compiler must fail if any PII-classified table has no retention period defined.

**Safe Default:** Without retention-archival-policy, data accumulates indefinitely, creating storage cost growth and GDPR right-to-erasure compliance failures.

**Dependencies:**
- `pii-classification-policy` (security compiler)
- `partitioning-strategy-spec.json` (for partition-based archival)

**Downstream Consumers:**
- `backup-policy`
- `data-masking-policy`
- `storage-growth-policy`
- `job-scheduling-policy`

---

### 11. `backup-policy`

**Frequency:** per-project

**Input:**
- `db-provisioning-spec.json`
- RPO (Recovery Point Objective) requirements
- RTO (Recovery Time Objective) requirements
- Backup destination (S3, managed provider, cross-region)
- Environment list

**Output:**
- `backup-policy.json` — per-environment backup rules: backup type (full / incremental / WAL streaming), schedule (cron expression), retention period, backup destination, cross-region replication flag, encryption-at-rest flag, backup verification cadence, PITR (point-in-time recovery) window

**Spec file:** `backup-policy.spec.json`

**Correctness Gates:**
1. Backup schedule cron expression is valid and parseable
2. PITR window ≥ declared RPO for every production environment
3. Backup retention period ≥ PITR window (cannot retain backups shorter than recovery window)
4. Cross-region backup replication is `required: true` for `ha_tier: production`
5. Backup encryption is `required: true` for any instance with PII data
6. Backup verification cadence is defined (not just "backups exist")
7. Backup destination is not the same server/region as the source instance

**Error Codes:**
- `DBA100` — PITR window shorter than declared RPO
- `DBA101` — Backup retention shorter than PITR window
- `DBA102` — Production instance missing cross-region backup
- `DBA103` — PII instance backup not encrypted
- `DBA104` — Backup verification cadence not defined

**Key Invariant:** Compiler must fail if the PITR window for any production instance is shorter than the declared RPO.

**Safe Default:** Without backup-policy, backups may exist with default provider settings, but PITR windows and retention periods are unvalidated against RPO requirements.

**Dependencies:**
- `db-provisioning-spec.json`
- `retention-archival-policy.json`

**Downstream Consumers:**
- `restore-verification-spec`
- `disaster-recovery-spec`
- `failover-policy`

---

### 12. `restore-verification-spec`

**Frequency:** per-project

**Input:**
- `backup-policy.json`
- Restore target environment spec
- Verification step list (schema check, row count check, application smoke test)
- Data masking requirements for restore targets

**Output:**
- `restore-verification-spec.json` — restore verification procedure: backup source reference, restore target environment, verification steps (ordered), schema validation check, row count tolerance (±N%), application-level smoke test references, PII masking step (required if restoring to non-production), time-to-restore measurement requirement

**Spec file:** `restore-verification-spec.spec.json`

**Correctness Gates:**
1. At least three verification steps are defined (not just "restore succeeded")
2. Schema validation step is present (restored schema matches expected schema)
3. Row count check tolerance is a specific percentage (not "approximately correct")
4. If restore target is non-production, PII masking step is required before verification
5. Time-to-restore measurement is required for production restore specs (validates RTO)
6. Smoke test references are resolvable (reference known test IDs or API route checks)
7. Every verification step has a pass/fail criterion (binary, not qualitative)

**Error Codes:**
- `DBA110` — Fewer than three verification steps defined
- `DBA111` — Schema validation step absent
- `DBA112` — Non-production restore missing PII masking step
- `DBA113` — Verification step missing binary pass/fail criterion
- `DBA114` — Time-to-restore measurement missing from production spec

**Key Invariant:** Compiler must fail if a restore to any non-production environment has no PII data masking step before the verification phase.

**Safe Default:** Without restore-verification-spec, backups exist but restores are untested — the classic "backup exists but recovery is unverified" failure mode.

**Dependencies:**
- `backup-policy.json`
- `data-masking-policy.json`

**Downstream Consumers:**
- `disaster-recovery-spec`
- `restore-drill-report`

---

### 13. `replication-topology-spec`

**Frequency:** per-project

**Input:**
- Instance list (primary, replicas, regions)
- Replication mode (streaming / logical / cascading)
- Replication lag thresholds
- `instance-sizing-policy.json`

**Output:**
- `replication-topology-spec.json` — replication topology definition: primary instance reference, replica list (instance ID, region, replication mode, lag threshold, role: hot-standby/warm-standby/logical), synchronous commit setting, wal_level setting, max_wal_senders, replication slot policy

**Spec file:** `replication-topology-spec.spec.json`

**Correctness Gates:**
1. Exactly one instance is designated as `role: primary`
2. Every replica has a `lag_threshold_seconds` defined
3. `synchronous_commit` setting is declared (not inherited from default)
4. For production topologies, at least one replica is in a different AZ or region from primary
5. Replication slot policy is defined: `max_replication_slots` is set and > 0
6. `wal_level` is `replica` or `logical` (not `minimal`)
7. Every `hot-standby` replica has `hot_standby: true` explicitly declared

**Error Codes:**
- `DBA120` — No instance designated as primary
- `DBA121` — Replica missing lag threshold
- `DBA122` — Production topology: no cross-AZ or cross-region replica
- `DBA123` — wal_level is minimal (insufficient for replication)
- `DBA124` — Replication slot policy not defined

**Key Invariant:** Compiler must fail if a production replication topology has all replicas in the same AZ as the primary.

**Safe Default:** Without replication-topology-spec, replication is configured ad-hoc; lag thresholds are undeclared and standby behavior during failover is undefined.

**Dependencies:**
- `db-provisioning-spec.json`
- `instance-sizing-policy.json`

**Downstream Consumers:**
- `read-replica-routing-policy`
- `failover-policy`
- `disaster-recovery-spec`
- `db-health-check-spec`

---

### 14. `read-replica-routing-policy`

**Frequency:** per-project

**Input:**
- `replication-topology-spec.json`
- Query class list (read-heavy analytics / standard reads / writes)
- Staleness tolerance per query class
- Service inventory

**Output:**
- `read-replica-routing-policy.json` — per-query-class routing rules: query class name, allowed replica types, max acceptable lag (seconds), fallback behavior (route to primary / fail / degrade), load-balancing strategy (round-robin / least-connections / latency-based), replica exclusion conditions

**Spec file:** `read-replica-routing-policy.spec.json`

**Correctness Gates:**
1. Every query class has a routing rule defined
2. Max acceptable lag is a specific value in seconds (not "low" or "near real-time")
3. Fallback behavior is one of: `route-to-primary` | `fail` | `degrade`
4. Write operations must always route to primary (no writes to replica rule present)
5. Replica exclusion conditions are defined (e.g., exclude replica if lag > threshold)
6. Analytics/OLAP query class routes to dedicated replica, not shared application replica

**Error Codes:**
- `DBA130` — Query class missing routing rule
- `DBA131` — Max acceptable lag is non-numeric
- `DBA132` — Fallback behavior is not a valid option
- `DBA133` — Write operation allowed to route to replica
- `DBA134` — Analytics and OLTP query classes share same replica

**Key Invariant:** Compiler must fail if any write operation query class has a routing rule that permits routing to a read replica.

**Safe Default:** Without read-replica-routing-policy, all traffic routes to primary by default, wasting replica capacity and creating primary bottlenecks.

**Dependencies:**
- `replication-topology-spec.json`
- `query-performance-budget.json`

**Downstream Consumers:**
- `connection-pool-config` (replica pool entries)
- `db-health-check-spec`
- `failover-policy`

---

### 15. `failover-policy`

**Frequency:** per-project

**Input:**
- `replication-topology-spec.json`
- RPO / RTO requirements
- Failover mechanism (automatic / manual / semi-automatic)
- Health check thresholds from `db-health-check-spec`
- `read-replica-routing-policy.json`

**Output:**
- `failover-policy.json` — failover behavior definition: trigger conditions (health check failure criteria, lag threshold, connection failure count), failover mechanism, promote target selection (which replica is promoted, priority order), DNS/endpoint update strategy, stale replica guard (block promotion if lag > threshold), post-failover validation steps, rollback criteria

**Spec file:** `failover-policy.spec.json`

**Correctness Gates:**
1. Trigger conditions are quantitative (failure count, timeout value — not "if primary is down")
2. Promote target has a defined priority order (not arbitrary)
3. Stale replica guard defines a maximum lag threshold for promotion eligibility
4. DNS/endpoint update strategy is defined (not left to manual intervention)
5. Post-failover validation steps are defined (at least 3 binary checks)
6. Rollback criteria are defined for failed failovers
7. RPO risk window is calculated and declared (time of data loss if async replica promoted)

**Error Codes:**
- `DBA140` — Trigger condition is non-quantitative
- `DBA141` — Promote target has no priority order
- `DBA142` — Stale replica guard not defined (replica with high lag could be promoted)
- `DBA143` — Post-failover validation steps fewer than 3
- `DBA144` — RPO risk window not calculated for async replication topology

**Key Invariant:** Compiler must fail if no stale replica guard is defined, allowing a lagged replica to be promoted without data loss assessment.

**Safe Default:** Without failover-policy, failover behavior is platform-default or manual, with no stale replica guard and undefined post-failover validation.

**Dependencies:**
- `replication-topology-spec.json`
- `backup-policy.json`
- `db-health-check-spec.json`

**Downstream Consumers:**
- `disaster-recovery-spec`
- `restore-drill-report`

---

### 16. `timeout-policy`

**Frequency:** per-project

**Input:**
- Workload class list (OLTP reads / writes / analytics / migrations / batch jobs)
- Client SLA requirements (p99 latency targets)
- `connection-pool-config.json`
- `query-performance-budget.json`

**Output:**
- `timeout-policy.json` — per-workload-class timeout definitions: `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `deadlock_timeout`, `tcp_keepalives_idle`, `tcp_keepalives_interval`, application-level query timeout

**Spec file:** `timeout-policy.spec.json`

**Correctness Gates:**
1. Every workload class has all mandatory timeouts defined: `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`
2. `idle_in_transaction_session_timeout` is > 0 (never disabled — long-running transactions hold locks)
3. `lock_timeout` < `statement_timeout` (lock contention fails fast before statement times out)
4. Migration workload class has elevated `statement_timeout` with explicit justification
5. `deadlock_timeout` is defined (PostgreSQL default of 1s is acceptable but must be declared)
6. Analytics workload class has longer `statement_timeout` than OLTP class (different SLA)

**Error Codes:**
- `DBA150` — Workload class missing mandatory timeout
- `DBA151` — idle_in_transaction_session_timeout is zero or disabled
- `DBA152` — lock_timeout ≥ statement_timeout for same workload class
- `DBA153` — Migration class missing elevated statement_timeout justification
- `DBA154` — deadlock_timeout not declared

**Key Invariant:** Compiler must fail if `idle_in_transaction_session_timeout` is set to 0 (disabled) for any workload class.

**Safe Default:** Without timeout-policy, idle transactions hold locks indefinitely, causing lock contention cascades and connection pool exhaustion.

**Dependencies:**
- `connection-pool-config.json`
- `query-performance-budget.json`

**Downstream Consumers:**
- `db-user-provisioning-manifest` (timeouts applied at user level)
- `lock-contention-policy`
- `slow-query-analysis-spec`

---

### 17. `query-performance-budget`

**Frequency:** per-feature

**Input:**
- Query patterns (from `api-route` or explicit query list)
- SLA targets (p50, p95, p99 latency)
- `index-advisory-spec.json`
- Workload class assignment

**Output:**
- `query-perf-budget.json` — per-query-class budget: query pattern ID, workload class, p50/p95/p99 latency budget (ms), max rows scanned, max sequential scans allowed, max execution plan cost estimate, alert threshold

**Spec file:** `query-perf-budget.spec.json`

**Correctness Gates:**
1. Every query pattern has a p99 latency budget defined (in milliseconds)
2. Latency budgets are numeric (not "fast" or "acceptable")
3. OLTP query budgets have p99 ≤ 100ms (configurable but must be declared)
4. Every budget entry references at least one query pattern ID
5. Sequential scan threshold is defined (max rows before sequential scan is flagged)
6. Alert threshold is ≤ p99 budget (cannot alert after budget is already exceeded)
7. Cross-compiler: query patterns should reference known `api-route` patterns where possible

**Error Codes:**
- `DBA160` — Query pattern missing p99 latency budget
- `DBA161` — Latency budget is non-numeric
- `DBA162` — Alert threshold exceeds p99 budget
- `DBA163` — Sequential scan threshold not defined
- `DBA164` — Budget entry has no query pattern reference

**Key Invariant:** Compiler must fail if any query performance budget's alert threshold is greater than or equal to the p99 latency budget (alerts must fire before budget is breached).

**Safe Default:** Without query-performance-budget, query performance degrades silently with no declared thresholds or automated alerting triggers.

**Dependencies:**
- `index-advisory-spec.json`
- `timeout-policy.json`
- `openapi-spec` (already built — query pattern cross-reference)

**Downstream Consumers:**
- `slow-query-analysis-spec`
- `index-advisory-spec`
- `read-replica-routing-policy`
- `db-health-check-spec`

---

### 18. `slow-query-analysis-spec`

**Frequency:** daily

**Input:**
- Query log threshold configuration (log_min_duration_statement)
- Normalization rules (how to group similar queries)
- `query-performance-budget.json`
- Triage priority rules

**Output:**
- `slow-query-analysis-spec.json` — slow query detection and triage rules: log threshold (ms), normalization method (pg_stat_statements / query fingerprint), triage categories (budget-exceeded / new-slow / regression / known-acceptable), auto-escalation threshold, output report schema

**Spec file:** `slow-query-analysis-spec.spec.json`

**Correctness Gates:**
1. `log_min_duration_statement` is a specific millisecond value
2. Normalization method is declared: `pg_stat_statements` | `fingerprint` | `manual`
3. Every triage category has a binary classification rule
4. Auto-escalation threshold is defined (at what point a slow query triggers an alert vs. is logged)
5. Output report schema includes: query fingerprint, duration (p50/p95/p99), call count, table references, execution plan flag
6. Cross-compiler: slow query triage categories reference `query-performance-budget` thresholds

**Error Codes:**
- `DBA170` — log_min_duration_statement not defined
- `DBA171` — Normalization method not declared
- `DBA172` — Triage category has non-binary classification rule
- `DBA173` — Auto-escalation threshold not defined
- `DBA174` — Output report schema missing required fields

**Key Invariant:** Compiler must fail if `log_min_duration_statement` is set to `-1` (logging disabled) for any production environment.

**Safe Default:** Without slow-query-analysis-spec, slow queries accumulate without categorization or escalation, remaining invisible until user-facing degradation occurs.

**Dependencies:**
- `query-performance-budget.json`
- `timeout-policy.json`

**Downstream Consumers:**
- `index-advisory-spec` (feedback loop)
- `db-health-check-spec`

---

### 19. `vacuum-maintenance-policy`

**Frequency:** per-project

**Input:**
- Table list with update/delete frequency estimates
- Autovacuum configuration parameters
- Table bloat thresholds
- Maintenance window definitions
- `partitioning-strategy-spec.json` (for per-partition vacuum rules)

**Output:**
- `vacuum-policy.json` — vacuum and analyze rules: autovacuum_vacuum_threshold, autovacuum_vacuum_scale_factor, autovacuum_analyze_threshold, autovacuum_analyze_scale_factor, per-table overrides for high-churn tables, manual vacuum schedule for large tables, bloat alert threshold (% dead tuples), toast table vacuum rules, freeze rules (autovacuum_freeze_max_age)

**Spec file:** `vacuum-policy.spec.json`

**Correctness Gates:**
1. `autovacuum_freeze_max_age` is defined and < 2,000,000,000 (transaction ID wraparound prevention)
2. High-churn tables (> 10k updates/sec) have per-table autovacuum overrides
3. Bloat alert threshold is a specific percentage (not "too much bloat")
4. TOAST table vacuum policy is declared
5. Manual vacuum schedule exists for tables where autovacuum is insufficient
6. `vacuum_cost_delay` is defined (to prevent I/O saturation during vacuum)
7. Partitioned tables have per-partition vacuum rules (vacuum does not run on parent)

**Error Codes:**
- `DBA180` — autovacuum_freeze_max_age not defined or above safe threshold
- `DBA181` — High-churn table missing autovacuum override
- `DBA182` — Bloat alert threshold is non-numeric
- `DBA183` — TOAST table vacuum policy not declared
- `DBA184` — vacuum_cost_delay not defined

**Key Invariant:** Compiler must fail if `autovacuum_freeze_max_age` is not defined, risking transaction ID wraparound (database forced shutdown).

**Safe Default:** Without vacuum-maintenance-policy, autovacuum runs with PostgreSQL defaults, which are insufficient for high-churn tables, causing table bloat and eventual transaction ID wraparound.

**Dependencies:**
- `partitioning-strategy-spec.json`
- `job-scheduling-policy.json`

**Downstream Consumers:**
- `storage-growth-policy`
- `db-health-check-spec`
- `job-scheduling-policy`

---

### 20. `statistics-refresh-policy`

**Frequency:** per-project

**Input:**
- Table list with data volatility classification
- `vacuum-maintenance-policy.json` (analyze is coupled to vacuum)
- Query plan stability requirements
- `index-advisory-spec.json`

**Output:**
- `statistics-refresh-policy.json` — per-table statistics rules: analyze trigger (row-change-based / time-based / manual), per-table statistics target (default 100; override for high-cardinality columns), extended statistics declarations, manual analyze schedule for large tables with low update frequency

**Spec file:** `statistics-refresh-policy.spec.json`

**Correctness Gates:**
1. Every table with complex join queries has a `statistics_target` override declared
2. Extended statistics (`CREATE STATISTICS`) are declared for correlated column pairs used in WHERE clauses
3. Manual analyze schedule is defined for tables with low update frequency but high query importance
4. `default_statistics_target` is declared (not left to PostgreSQL default of 100 without consideration)
5. Statistics target overrides are specific integers (not "high" or "low")

**Error Codes:**
- `DBA190` — Join-heavy table missing statistics_target override
- `DBA191` — Correlated column pair missing extended statistics declaration
- `DBA192` — Low-update high-importance table missing manual analyze schedule
- `DBA193` — Statistics target is non-integer
- `DBA194` — default_statistics_target not declared

**Key Invariant:** Compiler must fail if any table with declared correlated columns in WHERE clauses has no `CREATE STATISTICS` declaration.

**Safe Default:** Without statistics-refresh-policy, the query planner uses inaccurate cardinality estimates, producing suboptimal execution plans and unexpected sequential scans.

**Dependencies:**
- `vacuum-maintenance-policy.json`
- `index-advisory-spec.json`

**Downstream Consumers:**
- `query-performance-budget`
- `db-health-check-spec`

---

### 21. `storage-growth-policy`

**Frequency:** per-project

**Input:**
- Current storage utilization per instance
- Data growth rate estimate (GB/month)
- `retention-archival-policy.json`
- `partitioning-strategy-spec.json`
- Alert threshold requirements

**Output:**
- `storage-growth-policy.json` — storage management rules: current utilization, growth rate estimate, alert thresholds (warning: 70%, critical: 85%), auto-scaling trigger (if platform supports), archival trigger, table size limits per table, index size limits, TOAST table size monitoring rules

**Spec file:** `storage-growth-policy.spec.json`

**Correctness Gates:**
1. Warning threshold < critical threshold < 100% (ordered thresholds)
2. Growth rate estimate is defined in GB/month (not "fast" or "slow")
3. Auto-scaling trigger is defined if platform supports dynamic storage scaling
4. Archival trigger references `retention-archival-policy` entry
5. Critical threshold action is defined (not just "alert" — must specify response)
6. Storage forecast to 12 months is calculated and declared
7. Index storage is monitored separately from table storage

**Error Codes:**
- `DBA200` — Warning threshold ≥ critical threshold
- `DBA201` — Growth rate estimate is non-numeric
- `DBA202` — Critical threshold missing response action
- `DBA203` — 12-month storage forecast not calculated
- `DBA204` — Index storage not separately monitored

**Key Invariant:** Compiler must fail if the critical storage threshold has no defined response action (cannot just alert with no remediation path).

**Safe Default:** Without storage-growth-policy, storage exhaustion occurs without warning, causing database write failures and application errors.

**Dependencies:**
- `retention-archival-policy.json`
- `partitioning-strategy-spec.json`
- `vacuum-maintenance-policy.json`

**Downstream Consumers:**
- `capacity-forecast`
- `db-health-check-spec`

---

### 22. `capacity-forecast`

**Frequency:** per-project

**Input:**
- `storage-growth-policy.json`
- `instance-sizing-policy.json`
- `connection-pool-config.json`
- Historical usage data (if available)
- Business growth projections

**Output:**
- `capacity-forecast.json` — 12-month forecast: storage utilization forecast (month-by-month), connection utilization forecast, instance class upgrade trigger point (projected date), read replica addition trigger (projected date), cost forecast, recommended action timeline

**Spec file:** `capacity-forecast.spec.json`

**Correctness Gates:**
1. Forecast covers exactly 12 months (month-by-month entries)
2. Storage forecast reaches 80% utilization: a date is calculated and declared
3. Instance upgrade trigger point is a specific date, not "eventually"
4. Cost forecast includes compute, storage, and backup costs separately
5. Recommended action timeline is ordered (no action recommended after its trigger point has passed)
6. Forecast assumptions are documented (growth rate, seasonality factors)

**Error Codes:**
- `DBA210` — Forecast covers fewer than 12 months
- `DBA211` — Storage 80% utilization date not calculated
- `DBA212` — Upgrade trigger is non-specific date
- `DBA213` — Cost forecast missing component breakdown
- `DBA214` — Forecast assumptions not documented

**Key Invariant:** Compiler must fail if the 12-month storage forecast reaches 80% utilization without a corresponding upgrade or archival action date defined.

**Safe Default:** Without capacity-forecast, infrastructure scaling decisions are reactive rather than proactive, causing emergency capacity events.

**Dependencies:**
- `storage-growth-policy.json`
- `instance-sizing-policy.json`

**Downstream Consumers:**
- Infrastructure planning
- `db-provisioning-spec` (feedback loop for upgrades)

---

### 23. `seed-bootstrap-data-policy`

**Frequency:** per-project

**Input:**
- Data model (from `db-migration` artifacts)
- Environment list
- PII classification
- `feature-flag` (shared compiler — for seeded feature states)
- `i18n` (shared compiler — for seeded locale data)

**Output:**
- `seed-data-policy.json` — seeding rules: per-environment seed data set definitions, seed execution order (dependency-ordered), idempotency requirement (re-runnable without duplication), PII-safe data rules (no real PII in non-production seeds), seed data version control strategy, conditional seed blocks (seed only if feature flag X is enabled)

**Spec file:** `seed-data-policy.spec.json`

**Correctness Gates:**
1. Seed execution order is a valid topological sort (no circular dependencies)
2. Every seed script is declared idempotent (`ON CONFLICT DO NOTHING` or equivalent)
3. Non-production seeds contain no real PII data (validated against PII field list)
4. Feature-flag-conditional seeds reference valid flag keys from `feature-flag` compiler output
5. i18n seed data references valid locale keys from `i18n` compiler output
6. Seed data version is declared and incremented on changes
7. Cross-compiler: seed data must not conflict with migration-defined constraints (FK, NOT NULL, unique)

**Error Codes:**
- `DBA220` — Seed execution order has circular dependency
- `DBA221` — Seed script is not declared idempotent
- `DBA222` — Non-production seed contains real PII value
- `DBA223` — Feature flag key not found in feature-flag output
- `DBA224` — i18n locale key not found in i18n output

**Key Invariant:** Compiler must fail if any non-production seed data entry contains a value classified as PII in `pii-classification-policy`.

**Safe Default:** Without seed-bootstrap-data-policy, seed scripts run in arbitrary order, are non-idempotent, and may include real production data in staging environments.

**Dependencies:**
- `db-migration` (already built — for schema compatibility)
- `data-masking-policy.json`
- `pii-classification-policy` (security compiler)
- `feature-flag` (shared compiler)
- `i18n` (shared compiler)

**Downstream Consumers:**
- CI/CD pipeline (test environment setup)
- `data-integrity-validation-spec`

---

### 24. `data-masking-policy`

**Frequency:** per-project

**Input:**
- `pii-classification-policy` (security compiler)
- Environment list (which environments are non-production)
- Masking strategy options (static / dynamic / tokenization / nullification)
- Field-level masking rules

**Output:**
- `data-masking-policy.json` — per-field masking rules: field name, table name, PII tier, masking strategy, masking function (hash / partial-mask / nullify / synthetic-replacement), environment applicability, reversibility flag (irreversible masking for staging), verification step

**Spec file:** `data-masking-policy.spec.json`

**Correctness Gates:**
1. Every field classified as PII in `pii-classification-policy` has a masking rule
2. Staging/dev environment masking is `irreversible: true` (no way to recover original data)
3. Masking strategy is one of: `hash` | `partial-mask` | `nullify` | `synthetic-replacement` | `tokenization`
4. Email fields use format-preserving masking (output is still a valid email format)
5. Verification step is defined (how to confirm masking was applied correctly)
6. No masking rule has `environment: production` (masking only applies to non-production)
7. Cross-compiler: masking policy covers every PII field in `db-migration` schema artifacts

**Error Codes:**
- `DBA230` — PII field missing masking rule
- `DBA231` — Non-production masking is reversible
- `DBA232` — Masking strategy is not a valid type
- `DBA233` — Masking rule applied to production environment
- `DBA234` — Email field masking is not format-preserving

**Key Invariant:** Compiler must fail if any field classified as PII-tier in `pii-classification-policy` has no corresponding masking rule.

**Safe Default:** Without data-masking-policy, production PII data is copied into staging/dev environments, creating data breach risk and GDPR violations.

**Dependencies:**
- `pii-classification-policy` (security compiler)
- `retention-archival-policy.json`

**Downstream Consumers:**
- `restore-verification-spec`
- `seed-bootstrap-data-policy`
- `db-audit-log-policy`

---

### 25. `db-audit-log-policy`

**Frequency:** per-project

**Input:**
- `role-privilege-policy.json`
- Compliance requirements (SOC2, GDPR, HIPAA)
- Event taxonomy (connection, authentication, DDL, DML on sensitive tables, role changes)
- Log destination config
- `audit-log-policy` (security compiler — for alignment)

**Output:**
- `db-audit-log-policy.json` — database audit rules: event categories to log (DDL / DML / authentication / connection / role-change), per-table DML logging for PII tables, log destination (syslog / file / external SIEM), retention period, tamper-evidence requirement, exclusion list (high-volume low-risk queries to exclude), pgaudit extension config

**Spec file:** `db-audit-log-policy.spec.json`

**Correctness Gates:**
1. DDL events (CREATE, ALTER, DROP) are always logged in production
2. Authentication events are always logged (success and failure)
3. DML events on PII-tier tables are logged (at minimum SELECT and all write operations)
4. Role change events (GRANT, REVOKE) are always logged
5. Log destination is append-only or tamper-evident
6. Audit log retention is ≥ compliance minimum (90 days for SOC2, 365 days for HIPAA)
7. Cross-compiler: audit events must align with `audit-log-policy` event taxonomy (security compiler)
8. pgaudit extension is declared if PostgreSQL-level auditing is required

**Error Codes:**
- `DBA240` — DDL events not logged in production
- `DBA241` — Authentication failure events not logged
- `DBA242` — DML on PII table not logged
- `DBA243` — Audit log retention below compliance minimum
- `DBA244` — Log destination is not tamper-evident

**Key Invariant:** Compiler must fail if DML operations on any PII-classified table are not logged.

**Safe Default:** Without db-audit-log-policy, database access is unaudited, making compliance attestation impossible and insider threats undetectable.

**Dependencies:**
- `role-privilege-policy.json`
- `pii-classification-policy` (security compiler)
- `audit-log-policy` (security compiler — for cross-alignment)

**Downstream Consumers:**
- SIEM integration
- Compliance reporting

---

### 26. `migration-execution-policy`

**Frequency:** per-project

**Input:**
- `db-migration` artifacts (already built — for context)
- `lock-contention-policy.json`
- Live traffic constraints (peak traffic windows)
- Rollback strategy requirements
- `schema-ownership-policy.json`

**Output:**
- `migration-exec-policy.json` — migration execution rules: allowed execution windows, forbidden peak-traffic windows, lock acquisition timeout, lock timeout strategy (zero-downtime alternatives: shadow tables, online schema change), rollback procedure per migration type (DDL rollback vs data rollback), blue/green or expand-contract pattern requirements, migration author authorization

**Spec file:** `migration-exec-policy.spec.json`

**Correctness Gates:**
1. Execution windows are defined with cron-compatible time ranges
2. Peak traffic windows are explicitly forbidden for DDL migrations
3. Lock timeout is defined for every migration type (ADD COLUMN, ADD INDEX, DROP COLUMN, etc.)
4. Zero-downtime alternatives are specified for lock-heavy operations (ADD COLUMN with DEFAULT on large tables)
5. Rollback procedure is defined for every migration class
6. Migration author authorization list is non-empty
7. Cross-compiler: migration execution windows must not conflict with `job-scheduling-policy` maintenance windows (no overlap)

**Error Codes:**
- `DBA250` — Execution window not defined
- `DBA251` — DDL migration permitted during peak traffic window
- `DBA252` — Lock timeout not defined for migration type
- `DBA253` — No rollback procedure for migration class
- `DBA254` — Migration execution window conflicts with job scheduling window

**Key Invariant:** Compiler must fail if any DDL migration type has no lock timeout defined (risk of indefinite lock on live tables).

**Safe Default:** Without migration-exec-policy, migrations run at arbitrary times without lock timeout, risking table locks during peak traffic that cascade into application outages.

**Dependencies:**
- `lock-contention-policy.json`
- `schema-ownership-policy.json`
- `job-scheduling-policy.json`

**Downstream Consumers:**
- CI/CD migration pipeline
- `db-health-check-spec`

---

### 27. `data-integrity-validation-spec`

**Frequency:** per-feature

**Input:**
- Schema definition (from `db-migration` artifacts)
- Referential integrity rules (FK relationships)
- Business rule constraint inventory
- `seed-bootstrap-data-policy.json`

**Output:**
- `data-integrity-spec.json` — validation rule set: FK constraint verification queries, uniqueness constraint checks, NOT NULL coverage checks, orphaned record detection queries, business rule constraint checks (CHECK constraints), cross-table consistency checks, validation frequency (on-demand / scheduled / post-migration)

**Spec file:** `data-integrity-spec.spec.json`

**Correctness Gates:**
1. Every declared FK relationship has a corresponding integrity check query
2. Every uniqueness constraint has a verification query
3. Orphaned record detection is defined for all FK relationships with CASCADE or SET NULL behavior
4. Business rule constraints are expressed as executable SQL CHECK expressions
5. Validation queries are idempotent (read-only, no side effects)
6. Cross-compiler: every FK relationship in `db-migration` artifacts has a validation entry

**Error Codes:**
- `DBA260` — FK relationship missing integrity check query
- `DBA261` — Uniqueness constraint missing verification query
- `DBA262` — Orphaned record detection missing for FK with CASCADE behavior
- `DBA263` — Business rule constraint is not a valid SQL CHECK expression
- `DBA264` — Validation query has side effects (not read-only)

**Key Invariant:** Compiler must fail if any FK relationship declared in migration artifacts has no corresponding integrity check query in this spec.

**Safe Default:** Without data-integrity-validation-spec, constraint violations accumulate silently (particularly orphaned records after cascade deletes or soft-delete inconsistencies).

**Dependencies:**
- `db-migration` (already built — FK and constraint definitions)
- `schema-ownership-policy.json`

**Downstream Consumers:**
- `restore-verification-spec` (post-restore integrity check)
- `restore-drill-report`
- CI/CD post-migration validation

---

### 28. `db-health-check-spec`

**Frequency:** per-project

**Input:**
- Instance list
- Metric thresholds (connection count, replication lag, cache hit rate, bloat, query latency)
- `replication-topology-spec.json`
- `connection-pool-config.json`
- `query-performance-budget.json`

**Output:**
- `db-health-check-spec.json` — health check definition: readiness check criteria (all must pass for "healthy"), liveness check criteria (minimum to avoid restart), per-metric thresholds (connection utilization, replication lag, cache hit ratio, index hit ratio, table bloat, long-running query count, lock wait count), check frequency, degraded state definition

**Spec file:** `db-health-check-spec.spec.json`

**Correctness Gates:**
1. Readiness and liveness checks are defined separately (not combined)
2. Every metric threshold is a specific numeric value (not "high" or "too many")
3. Replication lag threshold references `replication-topology-spec` lag_threshold values
4. Connection utilization threshold is defined as a percentage of `max_connections`
5. Cache hit ratio threshold is defined (typically ≥ 99% for OLTP workloads)
6. Long-running query threshold references `timeout-policy` `statement_timeout`
7. Degraded state is explicitly defined (between healthy and unhealthy — not binary only)
8. Check frequency is a specific interval (not "frequently")

**Error Codes:**
- `DBA270` — Readiness and liveness checks not separated
- `DBA271` — Metric threshold is non-numeric
- `DBA272` — Replication lag threshold doesn't reference topology spec
- `DBA273` — Degraded state not defined
- `DBA274` — Check frequency is non-specific

**Key Invariant:** Compiler must fail if readiness checks and liveness checks are not defined as separate, distinct check sets.

**Safe Default:** Without db-health-check-spec, database health is inferred from application-level errors rather than proactive database-level signals.

**Dependencies:**
- `replication-topology-spec.json`
- `connection-pool-config.json`
- `query-performance-budget.json`
- `timeout-policy.json`

**Downstream Consumers:**
- `failover-policy`
- Monitoring/alerting systems
- Load balancer health checks

---

### 29. `materialized-view-refresh-policy`

**Frequency:** per-feature

**Input:**
- Materialized view list with dependency graph
- Staleness tolerance per view
- Source table update frequency
- Refresh method (CONCURRENT / non-concurrent)
- `job-scheduling-policy.json`

**Output:**
- `matview-refresh-policy.json` — per-view refresh rules: view name, refresh method (`CONCURRENT` / non-concurrent), refresh trigger (time-based cron / event-based / manual), staleness tolerance (seconds), dependency order (topological sort of dependent views), exclusive lock behavior (non-concurrent refresh blocks reads), failure behavior

**Spec file:** `matview-refresh-policy.spec.json`

**Correctness Gates:**
1. Every materialized view has a refresh trigger defined (cannot be undefined)
2. `CONCURRENT` refresh is required for views on tables with continuous read traffic
3. Dependency order is a valid topological sort (no circular view dependencies)
4. Staleness tolerance is a specific value in seconds (not "near real-time")
5. Non-concurrent refresh on production-read views is flagged as a lock risk
6. Failure behavior is defined (skip and alert / retry / cascade-skip downstream views)
7. Cross-compiler: refresh schedule must not conflict with peak-traffic windows from `migration-exec-policy`

**Error Codes:**
- `DBA280` — Materialized view missing refresh trigger
- `DBA281` — Non-concurrent refresh on high-read view without lock risk acknowledgment
- `DBA282` — Dependency order has circular reference
- `DBA283` — Staleness tolerance is non-numeric
- `DBA284` — Failure behavior not defined

**Key Invariant:** Compiler must fail if any materialized view on a table with active read traffic uses non-concurrent refresh without an explicit lock risk acknowledgment.

**Safe Default:** Without matview-refresh-policy, materialized views are refreshed manually or not at all, serving stale data without declared tolerance bounds.

**Dependencies:**
- `job-scheduling-policy.json`
- `timeout-policy.json`

**Downstream Consumers:**
- `job-scheduling-policy`
- `db-health-check-spec`

---

### 30. `multi-tenant-isolation-spec`

**Frequency:** per-project

**Input:**
- Tenant model (schema-per-tenant / row-level / database-per-tenant)
- `role-privilege-policy.json`
- `schema-ownership-policy.json`
- Tenant placement rules (shard assignment, affinity)

**Output:**
- `tenant-isolation-spec.json` — tenant isolation rules: isolation strategy, tenant identifier (column name / schema name), row-level security policy definitions (policy name, USING expression, WITH CHECK expression), cross-tenant query prevention rules, tenant data migration rules, tenant offboarding data deletion spec

**Spec file:** `tenant-isolation-spec.spec.json`

**Correctness Gates:**
1. Isolation strategy is explicitly one of: `row-level` | `schema-per-tenant` | `database-per-tenant`
2. For `row-level` strategy: RLS is enabled on every table containing tenant-scoped data
3. RLS `USING` expression references the declared tenant identifier column
4. `FORCE ROW LEVEL SECURITY` is applied to the table owner role
5. No role has `BYPASSRLS` except explicitly declared admin roles
6. Cross-tenant query prevention: tenant identifier is validated at the connection/session level
7. Tenant offboarding data deletion procedure is defined and references `retention-archival-policy`

**Error Codes:**
- `DBA290` — Tenant-scoped table missing RLS policy
- `DBA291` — RLS USING expression does not reference tenant identifier column
- `DBA292` — Role has BYPASSRLS without admin declaration
- `DBA293` — FORCE ROW LEVEL SECURITY not applied to table owner
- `DBA294` — Tenant offboarding deletion procedure not defined

**Key Invariant:** Compiler must fail if any table containing tenant-scoped data has RLS disabled.

**Safe Default:** Without multi-tenant-isolation-spec, tenant data is accessible across tenants through the application layer only, creating data isolation failures if RLS is absent.

**Dependencies:**
- `role-privilege-policy.json`
- `schema-ownership-policy.json`
- `retention-archival-policy.json`

**Downstream Consumers:**
- `db-user-provisioning-manifest`
- `db-audit-log-policy`
- `data-integrity-validation-spec`

---

### 31. `disaster-recovery-spec`

**Frequency:** per-project

**Input:**
- `backup-policy.json`
- `failover-policy.json`
- `restore-verification-spec.json`
- `replication-topology-spec.json`
- RTO / RPO requirements

**Output:**
- `dr-spec.json` — complete DR definition: recovery scenarios (primary failure / region failure / data corruption / accidental deletion), per-scenario recovery procedure, RTO and RPO targets per scenario, responsible parties, communication checklist, data loss risk assessment, DR test schedule

**Spec file:** `dr-spec.spec.json`

**Correctness Gates:**
1. All four recovery scenarios are defined: primary failure, region failure, data corruption, accidental deletion
2. Every scenario has a declared RTO and RPO target
3. Every scenario's recovery procedure references specific artifact IDs (backup ID, failover policy ID, restore spec ID)
4. DR test schedule is defined with a specific cadence (quarterly at minimum)
5. Data loss risk assessment is calculated for async replication scenarios
6. Communication checklist is present (who is notified at what step)
7. RTO targets are achievable given the restore-verification-spec time measurements

**Error Codes:**
- `DBA300` — Recovery scenario missing RTO/RPO target
- `DBA301` — Recovery procedure references non-existent artifact
- `DBA302` — DR test schedule not defined
- `DBA303` — Data loss risk not assessed for async replication scenario
- `DBA304` — RTO target not achievable per restore-verification measurements

**Key Invariant:** Compiler must fail if any recovery scenario has no declared RTO/RPO target.

**Safe Default:** Without disaster-recovery-spec, recovery from failures is improvised, with no validated procedure or time targets, causing extended downtime.

**Dependencies:**
- `backup-policy.json`
- `failover-policy.json`
- `restore-verification-spec.json`
- `replication-topology-spec.json`

**Downstream Consumers:**
- `restore-drill-report`

---

### 32. `restore-drill-report`

**Frequency:** per-incident (scheduled quarterly minimum)

**Input:**
- `restore-verification-spec.json`
- `disaster-recovery-spec.json`
- Backup artifacts (actual backup files from backup system)
- `data-masking-policy.json` (for non-production restore)

**Output:**
- `restore-drill-report.json` — drill execution record: drill date, scenario tested, backup point used (timestamp), restore target environment, time-to-restore (actual vs RTO target), verification step results (pass/fail per step), data loss window (actual vs RPO target), issues found, remediation items, attestation signature

**Spec file:** `restore-drill-report.spec.json`

**Correctness Gates:**
1. Every verification step from `restore-verification-spec` has a recorded result (pass/fail)
2. Actual time-to-restore is recorded (cannot be estimated)
3. Actual data loss window is recorded and compared to RPO target
4. Report is signed/attested (cryptographic or approval workflow reference)
5. Issues found section is present (empty is acceptable; absent is not)
6. Remediation items have assigned owners and deadlines
7. Drill cadence: report date is within the required DR test schedule interval

**Error Codes:**
- `DBA310` — Verification step missing recorded result
- `DBA311` — Time-to-restore is estimated rather than measured
- `DBA312` — Report has no attestation signature
- `DBA313` — Remediation items have no assigned owner or deadline
- `DBA314` — Drill cadence exceeds DR test schedule interval

**Key Invariant:** Compiler must fail if any verification step from `restore-verification-spec` has no recorded result in the drill report.

**Safe Default:** Without restore-drill-reports, backup infrastructure is unvalidated; actual recovery capability is unknown until a real disaster occurs.

**Dependencies:**
- `restore-verification-spec.json`
- `disaster-recovery-spec.json`
- `data-masking-policy.json`

**Downstream Consumers:**
- `disaster-recovery-spec` (feedback loop — update RTO/RPO targets based on drill results)
- Compliance attestation

---

### 33. `lock-contention-policy`

**Frequency:** per-project

**Input:**
- Transaction profile (read-heavy / write-heavy / mixed)
- `timeout-policy.json`
- Migration execution requirements
- Deadlock detection threshold

**Output:**
- `lock-contention-policy.json` — lock management rules: `deadlock_timeout` setting, lock monitoring threshold (lock wait duration before alerting), long-transaction alert threshold, advisory lock usage policy, lock escalation prevention rules (no table-level locks in OLTP), explicit lock mode usage rules (when SHARE vs EXCLUSIVE is permitted)

**Spec file:** `lock-contention-policy.spec.json`

**Correctness Gates:**
1. `deadlock_timeout` is defined and < 2000ms for OLTP workloads
2. Lock wait alert threshold is defined in milliseconds
3. Long-transaction alert threshold is defined and ≤ `idle_in_transaction_session_timeout`
4. Advisory lock usage is declared: `allowed` | `forbidden` | `allowed-with-ttl`
5. Table-level lock modes (ACCESS EXCLUSIVE) are restricted to maintenance windows only
6. Lock monitoring query is defined and is a valid pg_locks query

**Error Codes:**
- `DBA320` — deadlock_timeout not defined
- `DBA321` — Lock wait alert threshold not defined
- `DBA322` — Advisory lock usage not declared
- `DBA323` — ACCESS EXCLUSIVE locks permitted outside maintenance windows
- `DBA324` — Lock monitoring query is not valid

**Key Invariant:** Compiler must fail if `deadlock_timeout` is not defined for any OLTP workload class.

**Safe Default:** Without lock-contention-policy, deadlocks and lock contention cascade silently until connection pool exhaustion or transaction rollback storms occur.

**Dependencies:**
- `timeout-policy.json`
- `migration-execution-policy.json`

**Downstream Consumers:**
- `migration-execution-policy`
- `db-health-check-spec`
- `slow-query-analysis-spec`

---

### 34. `job-scheduling-policy`

**Frequency:** per-project

**Input:**
- Database maintenance task list (vacuum, analyze, reindex, refresh matviews, backup verification, retention cleanup)
- Maintenance window definitions
- Task dependency graph
- `vacuum-maintenance-policy.json`
- `materialized-view-refresh-policy.json`

**Output:**
- `job-scheduling-policy.json` — maintenance job schedule: job ID, task type, cron expression, execution environment (primary / replica / separate worker), dependency list (job IDs that must complete first), timeout per job, failure behavior (alert / retry / skip), resource limit (max I/O, max CPU during job)

**Spec file:** `job-scheduling-policy.spec.json`

**Correctness Gates:**
1. Every maintenance task has a cron expression (no underscheduled tasks)
2. Job dependency list forms a valid DAG (no circular dependencies)
3. Resource limits are defined per job (no unbounded I/O)
4. Failure behavior is one of: `alert` | `retry` | `skip` with a retry count if applicable
5. Jobs do not overlap with declared peak traffic windows
6. Backup verification job is scheduled (not just backup creation)
7. Cross-compiler: job schedule must not conflict with `migration-exec-policy` execution windows

**Error Codes:**
- `DBA330` — Maintenance task missing cron expression
- `DBA331` — Job dependency creates circular reference
- `DBA332` — Job has no resource limit defined
- `DBA333` — Job scheduled during peak traffic window
- `DBA334` — Backup verification job not scheduled

**Key Invariant:** Compiler must fail if any maintenance job has no timeout defined (unbounded jobs risk blocking maintenance windows for subsequent jobs).

**Safe Default:** Without job-scheduling-policy, maintenance tasks run ad-hoc or not at all, causing vacuum starvation, stale statistics, and unverified backups.

**Dependencies:**
- `vacuum-maintenance-policy.json`
- `materialized-view-refresh-policy.json`
- `backup-policy.json`
- `migration-execution-policy.json`

**Downstream Consumers:**
- `materialized-view-refresh-policy`
- `restore-drill-report` (restore drill scheduling)

---

### 35. `schema-drift-report`

**Frequency:** daily

**Input:**
- Schema snapshots from all environments (dev, staging, prod)
- Canonical schema state from `db-migration` artifacts
- `schema-ownership-policy.json`
- Previous day's drift report (for delta tracking)

**Output:**
- `schema-drift-report.json` — environment schema comparison: per-environment diff against canonical state (tables added/removed/modified, columns added/removed/modified, indexes added/removed, constraints added/removed), drift classification (expected-migration-pending / unexpected-manual-change / missing-migration), stale environment flag, coverage score

**Spec file:** `schema-drift-report.spec.json`

**Correctness Gates:**
1. Report covers 100% of environments in the environment list
2. Every schema object difference is classified (not reported as "different" without type)
3. `unexpected-manual-change` entries are flagged as critical (manual schema changes without migrations)
4. Report includes schema object counts per environment for verification
5. Report timestamp and source migration state SHA are present
6. Delta from previous report is computed (new drift vs resolved drift)
7. Cross-compiler: drift report validates against canonical state from `db-migration` artifact registry

**Error Codes:**
- `DBA340` — Environment not covered in drift report
- `DBA341` — Schema difference not classified
- `DBA342` — Manual schema change detected and not flagged critical
- `DBA343` — Report missing timestamp or migration SHA
- `DBA344` — Delta from previous report not computed

**Key Invariant:** Compiler must fail if any environment has an `unexpected-manual-change` entry that is not flagged as critical.

**Safe Default:** Without schema-drift-report, manual schema changes and missing migrations accumulate silently, causing environment inconsistencies that surface as production bugs.

**Dependencies:**
- `db-migration` (already built — canonical schema state)
- `schema-ownership-policy.json`

**Downstream Consumers:**
- Engineering sprint planning
- `migration-execution-policy` (feedback loop for pending migrations)
- `data-integrity-validation-spec`

---

## Recommended Build Order

The dependency graph resolves into tiers. Foundational provisioning and classification specs must precede policy compilers, which must precede operational and health compilers.

---

### Tier 0 — External Inputs (pre-conditions, not compilers)

These must exist before any DBA compiler can run. They come from adjacent compiler networks.

```
- pii-classification-policy       (security compiler)
- audit-log-policy                (security compiler)
- secret-handling-policy          (security compiler)
- db-migration                    (already built)
- openapi-spec                    (already built)
- feature-flag                    (shared)
- i18n                            (shared)
```

---

### Tier 1 — Foundational Instance & Governance Specs (no DBA compiler dependencies)

```
1. db-provisioning-spec           ← foundational instance definition
2. schema-ownership-policy        ← foundational schema governance
3. role-privilege-policy          ← foundational access control
4. retention-archival-policy      ← foundational data lifecycle
```

---

### Tier 2 — Core Sizing & Configuration Compilers (depend on Tier 1)

```
5.  instance-sizing-policy        ← depends on: db-provisioning-spec
6.  partitioning-strategy-spec    ← depends on: retention-archival-policy, schema-ownership-policy
7.  data-masking-policy           ← depends on: pii-classification-policy, retention-archival-policy
8.  db-user-provisioning-manifest ← depends on: role-privilege-policy, secret-handling-policy
```

---

### Tier 3 — Connection & Pool Compilers (depend on Tier 2)

```
9.  connection-pool-config        ← depends on: instance-sizing-policy, db-user-manifest
10. connection-string-contract    ← depends on: connection-pool-config, db-provisioning-spec, db-user-manifest
11. timeout-policy                ← depends on: connection-pool-config
12. lock-contention-policy        ← depends on: timeout-policy
```

---

### Tier 4 — Replication, Backup & HA Compilers (depend on Tier 2–3)

```
13. replication-topology-spec     ← depends on: db-provisioning-spec, instance-sizing-policy
14. backup-policy                 ← depends on: db-provisioning-spec, retention-archival-policy
15. read-replica-routing-policy   ← depends on: replication-topology-spec
```

---

### Tier 5 — Performance & Query Compilers (depend on Tier 3–4)

```
16. query-performance-budget      ← depends on: timeout-policy, openapi-spec
17. index-advisory-spec           ← depends on: query-performance-budget, schema-ownership-policy
18. slow-query-analysis-spec      ← depends on: query-performance-budget, timeout-policy
19. statistics-refresh-policy     ← depends on: index-advisory-spec
```

---

### Tier 6 — Maintenance & Storage Compilers (depend on Tier 5)

```
20. vacuum-maintenance-policy     ← depends on: partitioning-strategy-spec
21. storage-growth-policy         ← depends on: retention-archival-policy, partitioning-strategy-spec, vacuum-maintenance-policy
22. job-scheduling-policy         ← depends on: vacuum-maintenance-policy, backup-policy
23. materialized-view-refresh-policy ← depends on: job-scheduling-policy, timeout-policy
```

---

### Tier 7 — Audit, Integrity & Isolation Compilers (depend on Tier 6)

```
24. db-audit-log-policy           ← depends on: role-privilege-policy, pii-classification-policy, audit-log-policy
25. data-integrity-validation-spec ← depends on: db-migration, schema-ownership-policy
26. multi-tenant-isolation-spec   ← depends on: role-privilege-policy, schema-ownership-policy, retention-archival-policy
27. seed-bootstrap-data-policy    ← depends on: data-masking-policy, pii-classification-policy, db-migration
```

---

### Tier 8 — Migration & Health Compilers (depend on Tier 7)

```
28. migration-execution-policy    ← depends on: lock-contention-policy, schema-ownership-policy, job-scheduling-policy
29. db-health-check-spec          ← depends on: replication-topology-spec, connection-pool-config, query-performance-budget, timeout-policy
30. capacity-forecast             ← depends on: storage-growth-policy, instance-sizing-policy
```

---

### Tier 9 — Restore & DR Compilers (depend on Tier 8)

```
31. restore-verification-spec     ← depends on: backup-policy, data-masking-policy
32. failover-policy               ← depends on: replication-topology-spec, backup-policy, db-health-check-spec
33. disaster-recovery-spec        ← depends on: backup-policy, failover-policy, restore-verification-spec, replication-topology-spec
```

---

### Tier 10 — Operational / Validation Compilers (depend on full network)

```
34. restore-drill-report          ← depends on: restore-verification-spec, disaster-recovery-spec, data-masking-policy
35. schema-drift-report           ← depends on: db-migration, schema-ownership-policy (+ all environments)
```

---

### Full Linear Build Order (safe DAG serialization)

```
1.  db-provisioning-spec
2.  schema-ownership-policy
3.  role-privilege-policy
4.  retention-archival-policy
5.  instance-sizing-policy
6.  partitioning-strategy-spec
7.  data-masking-policy
8.  db-user-provisioning-manifest
9.  connection-pool-config
10. connection-string-contract
11. timeout-policy
12. lock-contention-policy
13. replication-topology-spec
14. backup-policy
15. read-replica-routing-policy
16. query-performance-budget
17. index-advisory-spec
18. slow-query-analysis-spec
19. statistics-refresh-policy
20. vacuum-maintenance-policy
21. storage-growth-policy
22. job-scheduling-policy
23. materialized-view-refresh-policy
24. db-audit-log-policy
25. data-integrity-validation-spec
26. multi-tenant-isolation-spec
27. seed-bootstrap-data-policy
28. migration-execution-policy
29. db-health-check-spec
30. capacity-forecast
31. restore-verification-spec
32. failover-policy
33. disaster-recovery-spec
34. restore-drill-report
35. schema-drift-report
```

---

*Document generated for: Domain Compiler Network — Database Administrator Role*
*Total compilers defined: 35*
*Excludes: already-built compilers (9) and shared/cross-role compilers (5)*
*Stack assumptions: PostgreSQL 14+, PgBouncer, Prisma/Drizzle, AWS RDS / Supabase / Neon, pgaudit extension*
*Cross-compiler checks defined against: db-migration, openapi-spec, pii-classification-policy, audit-log-policy, secret-handling-policy, feature-flag, i18n, authz-policy*
