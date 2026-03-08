
# database_admin_compiler_network.md

# Database Administrator Compiler Network

This document decomposes the database administrator role into atomic, repeatable task types suitable for a formal compiler network. Each compiler consumes a structured intent or spec and produces a verified, attested artifact.

Assumptions:
- Primary database platform: PostgreSQL
- Optional application layer: Prisma or Drizzle
- Optional cache and queue adjuncts: Redis where relevant
- Common operational tooling: PgBouncer, managed Postgres, backups, monitoring, observability
- Existing compilers already cover `db-migration`, so this document excludes raw migration artifacts themselves

Principles used for decomposition:
- Focus on DBA-owned operational artifacts
- Prefer machine-checkable outputs
- Keep each task small enough for one AI agent
- Separate policy from execution reports
- Separate steady-state governance from incident-specific reports
- Prioritize daily tasks first, then per-feature, then per-project, then per-incident

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| Database Provisioning Spec (`db-provisioning-spec`) | per-project | workload profile, environment matrix, provider constraints | `database/provisioning.spec.json` |
| Instance Sizing Policy (`instance-sizing-policy`) | per-project | workload classes, concurrency, storage forecast | `database/sizing.policy.json` |
| Connection Environment Contract (`connection-env-contract`) | per-project | service inventory, environment list, pool topology | `database/connection-contract.json` |
| Connection Pool Policy (`connection-pool-policy`) | per-project | workload concurrency, service connection patterns | `database/pool.policy.json` |
| Pooling Proxy Config (`pool-proxy-config`) | per-project | pool policy, environment contract, PgBouncer mode | `database/pgbouncer.config.json` |
| Role and Privilege Policy (`role-privilege-policy`) | per-project | service identities, access matrix, auth boundaries | `database/privileges.policy.json` |
| Database User Provisioning Manifest (`db-user-provisioning-manifest`) | per-feature | role policy, service accounts, tenant or environment scope | `database/users.manifest.json` |
| Schema Ownership Policy (`schema-ownership-policy`) | per-project | schema map, team ownership, migration boundaries | `database/schema-ownership.policy.json` |
| Migration Execution Policy (`migration-execution-policy`) | per-project | migration inventory, traffic profile, lock risk rules | `database/migration-execution.policy.json` |
| Index Policy (`index-policy`) | per-project | query classes, storage budget, write amplification budget | `database/index.policy.json` |
| Index Advisory Spec (`index-advisory-spec`) | daily | slow queries, workload traces, route usage | `database/index-advisories.json` |
| Partitioning Strategy Spec (`partitioning-strategy-spec`) | per-feature | table growth profile, retention rules, query patterns | `database/partitioning.spec.json` |
| Retention and Archival Policy (`retention-archival-policy`) | per-project | data classes, legal retention, cost constraints | `database/retention.policy.json` |
| Backup Policy (`backup-policy`) | per-project | RPO, retention, environment criticality | `database/backup.policy.json` |
| Restore Verification Spec (`restore-verification-spec`) | per-project | backup policy, integrity checks, restore targets | `database/restore-verification.spec.json` |
| Replication Topology Spec (`replication-topology-spec`) | per-project | HA goals, region layout, write and read patterns | `database/replication-topology.spec.json` |
| Read Replica Routing Policy (`read-replica-routing-policy`) | per-feature | replica topology, staleness tolerance, query classes | `database/read-routing.policy.json` |
| Failover Policy (`failover-policy`) | per-project | topology, lag thresholds, promotion rules | `database/failover.policy.json` |
| Timeout and Transaction Policy (`timeout-transaction-policy`) | per-project | workload classes, lock budgets, pool policy | `database/timeouts.policy.json` |
| Query Performance Budget Policy (`query-performance-budget-policy`) | per-project | SLOs, workload classes, route criticality | `database/performance-budgets.policy.json` |
| Slow Query Analysis Report (`slow-query-analysis-report`) | daily | query logs, fingerprints, plans, budgets | `database/slow-query-report.json` |
| Vacuum and Maintenance Policy (`vacuum-maintenance-policy`) | per-project | table churn, bloat risk, autovacuum stats | `database/vacuum.policy.json` |
| Statistics Refresh Policy (`statistics-refresh-policy`) | per-project | planner health data, table churn, partition profile | `database/statistics.policy.json` |
| Storage Growth Policy (`storage-growth-policy`) | per-project | table growth, WAL growth, index growth | `database/storage-growth.policy.json` |
| Capacity Forecast Report (`capacity-forecast-report`) | weekly | current storage, growth trends, tenant growth | `database/capacity-forecast.report.json` |
| Seed and Bootstrap Data Policy (`seed-bootstrap-data-policy`) | per-project | environment classes, seed inventories, shared compilers | `database/bootstrap-data.policy.json` |
| Data Masking Policy (`data-masking-policy`) | per-project | production schema, PII classes, non-prod environments | `database/data-masking.policy.json` |
| PII Handling Rules (`pii-db-handling-policy`) | per-project | data classification, schema inventory, access paths | `database/pii.policy.json` |
| Audit Logging Policy (`audit-logging-policy`) | per-project | access matrix, compliance scope, incident needs | `database/audit-logging.policy.json` |
| Disaster Recovery Spec (`disaster-recovery-spec`) | per-project | RPO, RTO, region topology, backup and failover policy | `database/disaster-recovery.spec.json` |
| Backup Verification Report (`backup-verification-report`) | daily | executed backup metadata, backup policy | `database/backup-verification.report.json` |
| Restore Drill Report (`restore-drill-report`) | per-incident | restore verification spec, backup artifacts, drill target | `database/restore-drill.report.json` |
| Data Integrity Validation Spec (`data-integrity-validation-spec`) | per-project | critical tables, invariants, replication model | `database/integrity-validation.spec.json` |
| Database Health Check Spec (`database-healthcheck-spec`) | per-project | SLOs, topology, lag and pool thresholds | `database/healthcheck.spec.json` |
| Materialized View Refresh Policy (`materialized-view-refresh-policy`) | per-feature | view inventory, staleness budget, lock constraints | `database/mview-refresh.policy.json` |
| Maintenance Job Schedule (`maintenance-job-schedule`) | per-project | all database maintenance policies | `database/maintenance-jobs.schedule.json` |
| Multi-tenant Isolation Rules (`multitenant-isolation-rules`) | per-project | tenancy model, schema rules, access matrix | `database/tenant-isolation.rules.json` |
| Shard or Tenant Placement Rules (`shard-placement-rules`) | per-feature | tenant volume, shard capacity, placement constraints | `database/shard-placement.rules.json` |
| Schema Drift Detection Report (`schema-drift-report`) | daily | environment snapshots, expected schema contract | `database/schema-drift.report.json` |
| Lock Contention Policy (`lock-contention-policy`) | per-project | migration windows, workload classes, lock budgets | `database/lock-contention.policy.json` |
| Deadlock Handling Spec (`deadlock-handling-spec`) | per-project | workload classes, retry rules, timeout policy | `database/deadlock-handling.spec.json` |
| Long-running Transaction Policy (`long-running-transaction-policy`) | per-project | transaction classes, maintenance windows, vacuum budgets | `database/long-transactions.policy.json` |

---

## Detailed Breakdown

## 1. Database Provisioning Spec

- **Name**: `db-provisioning-spec`
- **Frequency**: per-project
- **Input**: environment matrix, provider constraints, HA requirements, region requirements, workload class inventory
- **Output**: `database/provisioning.spec.json`
- **Spec file**:
```json
{
  "engine": "postgresql",
  "version": "16",
  "environments": ["dev", "staging", "prod"],
  "provider": "managed-postgres",
  "regions": ["eu-central-1"],
  "ha_mode": "single-primary-with-replicas",
  "extensions": ["pg_stat_statements"],
  "storage_encryption": true
}
```
- **Correctness gates**:
  - engine is `postgresql`
  - every environment defines version, region, HA mode, and encryption setting
  - required extensions are allowlisted
  - provisioning targets are compatible with replication topology if one exists
- **Dependencies**: none
- **Downstream consumers**: instance-sizing-policy, backup-policy, replication-topology-spec, connection-env-contract, healthcheck-spec
- **Error codes**: `DBA001`, `DBA002`, `DBA003`, `DBA004`
- **Key invariant**: fail if any production environment is unspecified for version, region, or HA mode.
- **Safe default**: one encrypted Postgres instance per environment, no HA, no replicas, minimal extension set.

## 2. Instance Sizing Policy

- **Name**: `instance-sizing-policy`
- **Frequency**: per-project
- **Input**: provisioning spec, workload classes, expected QPS, connection concurrency, memory and storage growth estimates
- **Output**: `database/sizing.policy.json`
- **Spec file**:
```json
{
  "workload_classes": {
    "oltp-primary": {
      "cpu_min": 4,
      "memory_gb_min": 16,
      "storage_gb_min": 200,
      "max_connections_budget": 300
    }
  },
  "headroom_percent": 30
}
```
- **Correctness gates**:
  - each workload class defines CPU, memory, storage, and connection budget
  - headroom percent is >= 20
  - sum of service pool allocations does not exceed max connection budget
  - storage minimum is greater than forecasted 90 day usage
- **Dependencies**: db-provisioning-spec
- **Downstream consumers**: connection-pool-policy, storage-growth-policy, capacity-forecast-report
- **Error codes**: `DBA010`, `DBA011`, `DBA012`, `DBA013`
- **Key invariant**: fail if projected concurrency or storage exceeds provisioned capacity within the forecast window.
- **Safe default**: conservative single workload class with 30 percent headroom.

## 3. Connection Environment Contract

- **Name**: `connection-env-contract`
- **Frequency**: per-project
- **Input**: service inventory, environment list, topology, secrets contract rules
- **Output**: `database/connection-contract.json`
- **Spec file**:
```json
{
  "services": {
    "api": {
      "env_var": "DATABASE_URL",
      "read_env_var": "DATABASE_READ_URL",
      "ssl_mode": "require",
      "pool_via_proxy": true
    }
  },
  "environments": ["dev", "staging", "prod"]
}
```
- **Correctness gates**:
  - every service has a write connection contract
  - production services define SSL mode
  - read-only endpoints are only defined when replica routing exists
  - no secret literal values are embedded in the contract
- **Dependencies**: db-provisioning-spec, replication-topology-spec
- **Downstream consumers**: backend services, connection-pool-policy, pool-proxy-config
- **Cross-compiler checks**:
  - must align with backend connection usage patterns if `api-route` artifacts exist
- **Error codes**: `DBA020`, `DBA021`, `DBA022`
- **Key invariant**: fail if any production service lacks a valid write connection contract.
- **Safe default**: one write DSN contract only, SSL required in production.

## 4. Connection Pool Policy

- **Name**: `connection-pool-policy`
- **Frequency**: per-project
- **Input**: sizing policy, service inventory, concurrency model, timeout policy
- **Output**: `database/pool.policy.json`
- **Spec file**:
```json
{
  "services": {
    "api": { "pool_size": 20, "min_idle": 2, "max_overflow": 0 },
    "worker": { "pool_size": 10, "min_idle": 1, "max_overflow": 0 }
  },
  "global": {
    "reserve_connections": 20,
    "idle_connection_ttl_sec": 300
  }
}
```
- **Correctness gates**:
  - sum of all pool sizes plus reserve is less than max connection budget
  - idle connection TTL is defined
  - production pools do not allow unbounded overflow
  - explicit rule exists for too many idle connections
- **Dependencies**: instance-sizing-policy, connection-env-contract
- **Downstream consumers**: pool-proxy-config, healthcheck-spec, timeout-transaction-policy
- **Edge cases covered**: pool exhaustion, too many idle connections
- **Error codes**: `DBA030`, `DBA031`, `DBA032`, `DBA033`
- **Key invariant**: fail if aggregate configured pool demand can exhaust database connections.
- **Safe default**: small fixed per-service pools with zero overflow and explicit reserve.

## 5. Pooling Proxy Config

- **Name**: `pool-proxy-config`
- **Frequency**: per-project
- **Input**: connection contract, pool policy, PgBouncer mode, transaction semantics
- **Output**: `database/pgbouncer.config.json`
- **Spec file**:
```json
{
  "mode": "transaction",
  "max_client_conn": 1000,
  "default_pool_size": 20,
  "reserve_pool_size": 5,
  "server_reset_query": "DISCARD ALL",
  "ignore_startup_parameters": ["extra_float_digits"]
}
```
- **Correctness gates**:
  - proxy mode is compatible with application session semantics
  - max_client_conn is greater than total service clients
  - reserve pool is defined
  - reset query is present unless explicitly disabled for a documented reason
- **Dependencies**: connection-pool-policy, connection-env-contract
- **Downstream consumers**: backend deployment configs, healthcheck-spec
- **Cross-compiler checks**:
  - must align with backend transaction behavior and driver pooling assumptions
- **Error codes**: `DBA040`, `DBA041`, `DBA042`
- **Key invariant**: fail if proxy mode can break application semantics or overcommit server connections.
- **Safe default**: transaction pooling with conservative limits.

## 6. Role and Privilege Policy

- **Name**: `role-privilege-policy`
- **Frequency**: per-project
- **Input**: service identities, access matrix, schema ownership boundaries, PII rules
- **Output**: `database/privileges.policy.json`
- **Spec file**:
```json
{
  "roles": {
    "app_writer": {
      "schemas": ["public"],
      "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"]
    },
    "app_reader": {
      "schemas": ["public"],
      "privileges": ["SELECT"]
    }
  },
  "default_privileges": "deny"
}
```
- **Correctness gates**:
  - default policy is deny
  - each role maps to explicit schemas and privileges
  - no application role has superuser or owner privileges
  - PII tagged tables require explicit allowlist
- **Dependencies**: schema-ownership-policy, pii-db-handling-policy
- **Downstream consumers**: db-user-provisioning-manifest, audit-logging-policy, security compilers
- **Cross-compiler checks**:
  - should align with service account usage and auth boundaries where present
- **Error codes**: `DBA050`, `DBA051`, `DBA052`, `DBA053`
- **Key invariant**: fail if any non-admin role gets broader privileges than required by policy.
- **Safe default**: deny all, create read and write application roles only.

## 7. Database User Provisioning Manifest

- **Name**: `db-user-provisioning-manifest`
- **Frequency**: per-feature
- **Input**: role policy, service accounts, tenant or environment scope
- **Output**: `database/users.manifest.json`
- **Spec file**:
```json
{
  "users": [
    {
      "username": "svc_api_prod",
      "role": "app_writer",
      "environment": "prod",
      "rotation_days": 90
    }
  ]
}
```
- **Correctness gates**:
  - every user references an existing role
  - usernames are unique per environment
  - rotation period is defined
  - no human login user is provisioned without audit flag
- **Dependencies**: role-privilege-policy, connection-env-contract
- **Downstream consumers**: secret provisioning, audit logging, security monitoring
- **Error codes**: `DBA060`, `DBA061`, `DBA062`
- **Key invariant**: fail if a user manifest references undefined roles or shares credentials across environments.
- **Safe default**: one service user per service per environment.

## 8. Schema Ownership Policy

- **Name**: `schema-ownership-policy`
- **Frequency**: per-project
- **Input**: schema map, team ownership, migration boundaries, extension ownership rules
- **Output**: `database/schema-ownership.policy.json`
- **Spec file**:
```json
{
  "schemas": {
    "public": { "owner_role": "db_owner", "migration_role": "db_migrator" },
    "analytics": { "owner_role": "db_owner", "migration_role": "analytics_migrator" }
  }
}
```
- **Correctness gates**:
  - each schema defines owner and migrator roles
  - application runtime roles are not owners
  - extension ownership is assigned to admin-only role
  - ownership map covers all declared schemas
- **Dependencies**: db-provisioning-spec
- **Downstream consumers**: role-privilege-policy, migration-execution-policy, db-migration compiler
- **Error codes**: `DBA070`, `DBA071`, `DBA072`
- **Key invariant**: fail if runtime service roles own schemas or objects.
- **Safe default**: central admin owner and separate migrator role.

## 9. Migration Execution Policy

- **Name**: `migration-execution-policy`
- **Frequency**: per-project
- **Input**: migration classes, traffic profile, lock-contention policy, timeout policy, zero-downtime requirements
- **Output**: `database/migration-execution.policy.json`
- **Spec file**:
```json
{
  "rules": {
    "ddl_lock_timeout_ms": 3000,
    "statement_timeout_ms": 15000,
    "require_expand_contract": true,
    "forbid_table_rewrite_on_hot_tables": true
  },
  "windows": {
    "prod": { "requires_low_traffic_window": true }
  }
}
```
- **Correctness gates**:
  - lock timeout and statement timeout are defined
  - explicit rule exists for zero-downtime migrations
  - table rewrites on hot tables are forbidden or exception-tagged
  - migration policy is compatible with live traffic constraints
- **Dependencies**: schema-ownership-policy, timeout-transaction-policy, lock-contention-policy
- **Downstream consumers**: db-migration, deployment pipeline, maintenance-job-schedule
- **Edge cases covered**: zero-downtime maintenance windows, migration policy conflicting with live traffic constraints
- **Error codes**: `DBA080`, `DBA081`, `DBA082`, `DBA083`
- **Key invariant**: fail if production migration policy allows blocking DDL without explicit bounded lock handling.
- **Safe default**: require expand-contract, strict timeouts, low-traffic windows.

## 10. Index Policy

- **Name**: `index-policy`
- **Frequency**: per-project
- **Input**: workload classes, query classes, storage budget, write amplification budget
- **Output**: `database/index.policy.json`
- **Spec file**:
```json
{
  "rules": {
    "require_predicate_alignment": true,
    "max_index_to_table_size_ratio": 1.5,
    "forbid_duplicate_indexes": true,
    "review_unused_after_days": 30
  }
}
```
- **Correctness gates**:
  - duplicate index rule exists
  - max index-to-table ratio is defined
  - unused index review threshold is defined
  - policy distinguishes OLTP and analytical query classes if both exist
- **Dependencies**: query-performance-budget-policy, storage-growth-policy
- **Downstream consumers**: index-advisory-spec, db-migration
- **Edge cases covered**: oversized indexes, unused indexes, missing indexes on high-cardinality filters
- **Error codes**: `DBA090`, `DBA091`, `DBA092`
- **Key invariant**: fail if index policy allows unbounded growth or duplicate indexes without detection.
- **Safe default**: minimal indexing with duplicate detection and size caps.

## 11. Index Advisory Spec

- **Name**: `index-advisory-spec`
- **Frequency**: daily
- **Input**: slow query logs, query fingerprints, execution plans, route or job usage, existing indexes
- **Output**: `database/index-advisories.json`
- **Spec file**:
```json
{
  "advisories": [
    {
      "query_fingerprint": "abc123",
      "table": "orders",
      "recommended_index": "(tenant_id, created_at desc)",
      "reason": "high-cardinality filter plus sort",
      "expected_benefit": "reduce p95 latency by 70%",
      "write_cost_score": 0.2
    }
  ]
}
```
- **Correctness gates**:
  - every advisory references a known query fingerprint
  - recommended index is not already present or duplicate-equivalent
  - write cost score is provided
  - advisory maps to actual observed or declared query pattern
- **Dependencies**: index-policy, slow-query-analysis-report
- **Downstream consumers**: db-migration, performance review
- **Cross-compiler checks**:
  - should map to known route usage when `api-route` artifacts exist
- **Error codes**: `DBA100`, `DBA101`, `DBA102`, `DBA103`
- **Key invariant**: fail if an index recommendation cannot be tied to a real query pattern.
- **Safe default**: no advisory generated.

## 12. Partitioning Strategy Spec

- **Name**: `partitioning-strategy-spec`
- **Frequency**: per-feature
- **Input**: table growth profile, retention policy, query predicates, hot/cold access patterns
- **Output**: `database/partitioning.spec.json`
- **Spec file**:
```json
{
  "tables": {
    "events": {
      "strategy": "range",
      "key": ["created_at"],
      "interval": "monthly",
      "retention_months": 12,
      "default_partition": false
    }
  }
}
```
- **Correctness gates**:
  - partition key is present in major filters or pruning predicates
  - interval is defined for range partitioning
  - retention aligns with retention policy
  - strategy is compatible with migration artifacts
- **Dependencies**: retention-archival-policy, query-performance-budget-policy
- **Downstream consumers**: db-migration, statistics-refresh-policy, vacuum-maintenance-policy
- **Edge cases covered**: partition key mistakes
- **Cross-compiler checks**:
  - must be compatible with db-migration outputs already produced elsewhere
- **Error codes**: `DBA110`, `DBA111`, `DBA112`
- **Key invariant**: fail if the partition key does not support pruning for dominant query patterns.
- **Safe default**: no partitioning.

## 13. Retention and Archival Policy

- **Name**: `retention-archival-policy`
- **Frequency**: per-project
- **Input**: data classes, legal retention, table inventory, access patterns, cost limits
- **Output**: `database/retention.policy.json`
- **Spec file**:
```json
{
  "tables": {
    "audit_logs": { "hot_days": 30, "archive_days": 365, "delete_after_days": 730 },
    "events": { "hot_days": 90, "archive_days": 365, "delete_after_days": 730 }
  }
}
```
- **Correctness gates**:
  - every governed table defines retention horizon
  - archive and delete phases are ordered correctly
  - PII tables do not exceed allowed retention without justification
  - storage-growth-policy references retention assumptions
- **Dependencies**: pii-db-handling-policy
- **Downstream consumers**: partitioning-strategy-spec, backup-policy, storage-growth-policy
- **Error codes**: `DBA120`, `DBA121`, `DBA122`
- **Key invariant**: fail if any governed table lacks a complete hot, archive, and delete lifecycle.
- **Safe default**: indefinite retention for non-PII and deny for PII export to non-prod.

## 14. Backup Policy

- **Name**: `backup-policy`
- **Frequency**: per-project
- **Input**: RPO targets, environment criticality, retention rules, provider capabilities
- **Output**: `database/backup.policy.json`
- **Spec file**:
```json
{
  "prod": {
    "base_backup_frequency_hours": 24,
    "point_in_time_recovery": true,
    "wal_retention_hours": 168,
    "retention_days": 30,
    "cross_region_copy": true
  }
}
```
- **Correctness gates**:
  - backup schedule, retention, restore target, and verification reference are defined
  - RPO target is stated and measurable
  - PITR is enabled for production unless exception-tagged
  - backup retention aligns with disaster recovery spec
- **Dependencies**: db-provisioning-spec, retention-archival-policy
- **Downstream consumers**: restore-verification-spec, backup-verification-report, disaster-recovery-spec
- **Edge cases covered**: backup exists but restore is unverified
- **Error codes**: `DBA130`, `DBA131`, `DBA132`, `DBA133`
- **Key invariant**: fail if production backup policy lacks verifiable restore path and retention.
- **Safe default**: daily base backup plus PITR with 30 day retention.

## 15. Restore Verification Spec

- **Name**: `restore-verification-spec`
- **Frequency**: per-project
- **Input**: backup policy, integrity checks, target environments, checksum rules
- **Output**: `database/restore-verification.spec.json`
- **Spec file**:
```json
{
  "restore_targets": ["latest", "point_in_time_minus_15m"],
  "verification_steps": ["boot", "integrity-check", "schema-check", "row-count-sanity"],
  "success_criteria": {
    "max_restore_duration_min": 60,
    "max_data_loss_min": 15
  }
}
```
- **Correctness gates**:
  - at least one point-in-time target is defined when PITR is enabled
  - verification steps include schema and integrity validation
  - restore duration and data loss success criteria are present
  - criteria are compatible with DR RTO and RPO
- **Dependencies**: backup-policy, data-integrity-validation-spec
- **Downstream consumers**: restore-drill-report, disaster-recovery-spec
- **Error codes**: `DBA140`, `DBA141`, `DBA142`
- **Key invariant**: fail if restore verification does not prove both recoverability and correctness.
- **Safe default**: verify latest backup restore only.

## 16. Replication Topology Spec

- **Name**: `replication-topology-spec`
- **Frequency**: per-project
- **Input**: HA goals, region layout, read and write patterns, provider constraints
- **Output**: `database/replication-topology.spec.json`
- **Spec file**:
```json
{
  "primary": "prod-primary",
  "replicas": [
    { "name": "prod-replica-1", "region": "eu-central-1", "purpose": "read" }
  ],
  "sync_mode": "async",
  "max_lag_seconds": 5
}
```
- **Correctness gates**:
  - exactly one primary exists per topology
  - each replica has purpose and region
  - max lag threshold is defined
  - sync mode is compatible with failover policy
- **Dependencies**: db-provisioning-spec
- **Downstream consumers**: read-replica-routing-policy, failover-policy, healthcheck-spec
- **Edge cases covered**: replication lag thresholds
- **Error codes**: `DBA150`, `DBA151`, `DBA152`
- **Key invariant**: fail if topology does not define measurable lag limits and promotion candidates.
- **Safe default**: single primary, no replicas.

## 17. Read Replica Routing Policy

- **Name**: `read-replica-routing-policy`
- **Frequency**: per-feature
- **Input**: replication topology, staleness tolerance, query classes, consistency requirements
- **Output**: `database/read-routing.policy.json`
- **Spec file**:
```json
{
  "query_classes": {
    "analytics-read": { "route": "replica", "max_staleness_seconds": 30 },
    "post-write-read": { "route": "primary", "reason": "read-your-writes" }
  }
}
```
- **Correctness gates**:
  - every replica-routed query class defines max staleness
  - post-write and strongly consistent reads route to primary
  - read-only replica behavior is explicitly declared
  - stale replica fail-open or fail-closed behavior is defined
- **Dependencies**: replication-topology-spec, connection-env-contract
- **Downstream consumers**: backend routing, healthcheck-spec
- **Edge cases covered**: read-only replica behavior, failover with stale replicas
- **Cross-compiler checks**:
  - must align with backend connection usage and query consistency assumptions
- **Error codes**: `DBA160`, `DBA161`, `DBA162`, `DBA163`
- **Key invariant**: fail if any replica-routed query lacks a bounded staleness contract.
- **Safe default**: all reads go to primary.

## 18. Failover Policy

- **Name**: `failover-policy`
- **Frequency**: per-project
- **Input**: topology, lag thresholds, candidate replicas, RTO goals
- **Output**: `database/failover.policy.json`
- **Spec file**:
```json
{
  "promotion": {
    "max_lag_seconds": 10,
    "candidate_order": ["prod-replica-1"],
    "require_wal_replay_caught_up": true
  },
  "traffic_action": {
    "freeze_writes_if_no_safe_candidate": true
  }
}
```
- **Correctness gates**:
  - promotion candidate order exists
  - stale replica threshold is defined
  - explicit rule exists for no-safe-candidate scenario
  - write freeze behavior is defined if consistency cannot be guaranteed
- **Dependencies**: replication-topology-spec, disaster-recovery-spec
- **Downstream consumers**: incident automation, healthcheck-spec, restore-drill-report
- **Edge cases covered**: failover with stale replicas
- **Error codes**: `DBA170`, `DBA171`, `DBA172`
- **Key invariant**: fail if policy permits promotion of replicas beyond allowed staleness.
- **Safe default**: no automatic promotion, freeze writes if primary is lost.

## 19. Timeout and Transaction Policy

- **Name**: `timeout-transaction-policy`
- **Frequency**: per-project
- **Input**: workload classes, lock budgets, pool policy, maintenance rules
- **Output**: `database/timeouts.policy.json`
- **Spec file**:
```json
{
  "statement_timeout_ms": {
    "interactive": 5000,
    "background": 30000
  },
  "lock_timeout_ms": 3000,
  "idle_in_transaction_session_timeout_ms": 60000
}
```
- **Correctness gates**:
  - statement, lock, and idle-in-transaction timeouts are all defined
  - background jobs have bounded timeout
  - idle-in-transaction timeout is non-zero in production
  - policy distinguishes interactive and background workloads if both exist
- **Dependencies**: connection-pool-policy
- **Downstream consumers**: migration-execution-policy, deadlock-handling-spec, long-running-transaction-policy
- **Edge cases covered**: long-running transactions
- **Error codes**: `DBA180`, `DBA181`, `DBA182`
- **Key invariant**: fail if production transactions can run indefinitely or idle in transaction indefinitely.
- **Safe default**: short interactive timeouts, bounded background timeouts, kill idle transactions.

## 20. Query Performance Budget Policy

- **Name**: `query-performance-budget-policy`
- **Frequency**: per-project
- **Input**: SLOs, workload classes, route criticality, tenant mix
- **Output**: `database/performance-budgets.policy.json`
- **Spec file**:
```json
{
  "classes": {
    "critical-read": { "p95_ms": 100, "rows_examined_limit": 10000 },
    "critical-write": { "p95_ms": 150, "lock_wait_ms_limit": 50 }
  }
}
```
- **Correctness gates**:
  - each workload class defines measurable latency budget
  - at least one planner or scan budget is specified
  - write budgets include lock wait or contention budget
  - slow-query analysis references these classes
- **Dependencies**: instance-sizing-policy
- **Downstream consumers**: slow-query-analysis-report, index-policy, healthcheck-spec
- **Cross-compiler checks**:
  - should map to declared workload classes or observed routes
- **Error codes**: `DBA190`, `DBA191`, `DBA192`
- **Key invariant**: fail if workload classes lack measurable latency or resource budgets.
- **Safe default**: p95 latency budgets for reads and writes only.

## 21. Slow Query Analysis Report

- **Name**: `slow-query-analysis-report`
- **Frequency**: daily
- **Input**: query logs, fingerprints, execution plans, budgets, index inventory
- **Output**: `database/slow-query-report.json`
- **Spec file**:
```json
{
  "generated_at": "2026-03-08T00:00:00Z",
  "violations": [
    {
      "fingerprint": "abc123",
      "class": "critical-read",
      "p95_ms": 480,
      "budget_ms": 100,
      "root_cause": ["missing-index", "replica-misroute"]
    }
  ]
}
```
- **Correctness gates**:
  - each violation maps to a workload class
  - budget delta is computable
  - root cause tags come from controlled vocabulary
  - report window is explicitly declared
- **Dependencies**: query-performance-budget-policy, database-healthcheck-spec
- **Downstream consumers**: index-advisory-spec, capacity-forecast-report, incident review
- **Error codes**: `DBA200`, `DBA201`, `DBA202`
- **Key invariant**: fail if a reported slow query cannot be tied to a budget and a fingerprint.
- **Safe default**: empty daily report.

## 22. Vacuum and Maintenance Policy

- **Name**: `vacuum-maintenance-policy`
- **Frequency**: per-project
- **Input**: table churn, bloat risk, autovacuum stats, partition profile
- **Output**: `database/vacuum.policy.json`
- **Spec file**:
```json
{
  "tables": {
    "orders": {
      "autovacuum_vacuum_scale_factor": 0.05,
      "autovacuum_analyze_scale_factor": 0.02,
      "freeze_age_alert_percent": 80
    }
  }
}
```
- **Correctness gates**:
  - hot tables define vacuum and analyze thresholds
  - freeze-age alert threshold is defined
  - policy includes rule for vacuum starvation detection
  - policy covers partitioned parents and children where relevant
- **Dependencies**: partitioning-strategy-spec, long-running-transaction-policy
- **Downstream consumers**: maintenance-job-schedule, healthcheck-spec
- **Edge cases covered**: vacuum starvation
- **Error codes**: `DBA210`, `DBA211`, `DBA212`
- **Key invariant**: fail if high-churn tables lack explicit vacuum and freeze protection settings.
- **Safe default**: rely on platform autovacuum defaults with alerts enabled.

## 23. Statistics Refresh Policy

- **Name**: `statistics-refresh-policy`
- **Frequency**: per-project
- **Input**: planner health, table churn, partition profile, query instability indicators
- **Output**: `database/statistics.policy.json`
- **Spec file**:
```json
{
  "tables": {
    "events": { "analyze_after_inserts": 100000, "extended_stats": [["tenant_id", "created_at"]] }
  }
}
```
- **Correctness gates**:
  - analyze threshold is defined for large mutable tables
  - extended statistics reference valid column sets
  - partitioned tables define parent and child handling policy
  - policy is compatible with query-performance budget assumptions
- **Dependencies**: partitioning-strategy-spec, vacuum-maintenance-policy
- **Downstream consumers**: maintenance-job-schedule, slow-query-analysis-report
- **Error codes**: `DBA220`, `DBA221`, `DBA222`
- **Key invariant**: fail if planner-critical tables have no statistics refresh rule.
- **Safe default**: autovacuum analyze only.

## 24. Storage Growth Policy

- **Name**: `storage-growth-policy`
- **Frequency**: per-project
- **Input**: table growth, WAL growth, retention policy, index policy
- **Output**: `database/storage-growth.policy.json`
- **Spec file**:
```json
{
  "thresholds": {
    "warn_at_percent": 70,
    "critical_at_percent": 85
  },
  "contributors": ["heap", "indexes", "wal", "archives"]
}
```
- **Correctness gates**:
  - warning and critical thresholds are defined
  - policy tracks heap, indexes, and WAL separately
  - thresholds are lower than provider hard limits
  - storage policy references retention controls
- **Dependencies**: instance-sizing-policy, retention-archival-policy, index-policy
- **Downstream consumers**: capacity-forecast-report, healthcheck-spec
- **Edge cases covered**: storage nearing limits
- **Error codes**: `DBA230`, `DBA231`, `DBA232`
- **Key invariant**: fail if storage policy cannot trigger action before hard capacity is reached.
- **Safe default**: warn at 70 percent, critical at 85 percent.

## 25. Capacity Forecast Report

- **Name**: `capacity-forecast-report`
- **Frequency**: weekly
- **Input**: storage metrics, query growth, tenant growth, pool trends, retention assumptions
- **Output**: `database/capacity-forecast.report.json`
- **Spec file**:
```json
{
  "forecast_window_days": 90,
  "projected": {
    "storage_percent_at_day_90": 78,
    "connections_peak_at_day_90": 240
  },
  "assumptions": ["tenant_growth_5_percent_monthly"]
}
```
- **Correctness gates**:
  - forecast window is declared
  - assumptions are explicit
  - projections include storage and connections at minimum
  - report indicates threshold crossing dates if any
- **Dependencies**: storage-growth-policy, connection-pool-policy, slow-query-analysis-report
- **Downstream consumers**: instance-sizing-policy revisions, shard-placement-rules
- **Error codes**: `DBA240`, `DBA241`, `DBA242`
- **Key invariant**: fail if forecast omits assumptions or threshold crossing predictions.
- **Safe default**: no forecast, treat capacity as unknown and block auto-scaling decisions.

## 26. Seed and Bootstrap Data Policy

- **Name**: `seed-bootstrap-data-policy`
- **Frequency**: per-project
- **Input**: environment classes, seed inventories, static lookup data, shared compiler outputs
- **Output**: `database/bootstrap-data.policy.json`
- **Spec file**:
```json
{
  "allowed_in_prod": ["country_codes", "roles"],
  "forbidden_in_prod": ["demo_users", "test_orders"],
  "idempotent": true
}
```
- **Correctness gates**:
  - prod allowlist is explicit
  - idempotency is declared
  - non-prod synthetic data sources are defined if needed
  - policy does not conflict with feature flags, i18n, or analytics bootstrap artifacts
- **Dependencies**: schema-ownership-policy
- **Downstream consumers**: db-migration, app bootstrap, shared compilers
- **Cross-compiler checks**:
  - must not conflict with shared `i18n`, `feature-flag`, or `analytics-event` bootstrap artifacts
- **Error codes**: `DBA250`, `DBA251`, `DBA252`
- **Key invariant**: fail if production bootstrap allows non-idempotent or demo data inserts.
- **Safe default**: disable all production seed data except mandatory lookup tables.

## 27. Data Masking Policy

- **Name**: `data-masking-policy`
- **Frequency**: per-project
- **Input**: production schema, PII classes, non-prod environment list
- **Output**: `database/data-masking.policy.json`
- **Spec file**:
```json
{
  "rules": {
    "users.email": "deterministic_hash",
    "users.phone": "null",
    "users.full_name": "faker_name"
  },
  "target_environments": ["dev", "staging"]
}
```
- **Correctness gates**:
  - every PII field copied to non-prod has a masking rule
  - target environments are explicit
  - irreversible masking is used where required
  - policy blocks production-to-staging raw copy for tagged columns
- **Dependencies**: pii-db-handling-policy
- **Downstream consumers**: staging refresh jobs, security policy, audit logging
- **Edge cases covered**: PII leaking into staging data
- **Error codes**: `DBA260`, `DBA261`, `DBA262`, `DBA263`
- **Key invariant**: fail if tagged PII can enter non-production without a masking rule.
- **Safe default**: block production data refresh to non-prod.

## 28. PII Handling Rules

- **Name**: `pii-db-handling-policy`
- **Frequency**: per-project
- **Input**: data classification, schema inventory, access paths, retention rules
- **Output**: `database/pii.policy.json`
- **Spec file**:
```json
{
  "columns": {
    "users.email": { "class": "direct_identifier", "encrypt_at_rest": true, "mask_in_non_prod": true },
    "users.phone": { "class": "direct_identifier", "encrypt_at_rest": true, "mask_in_non_prod": true }
  }
}
```
- **Correctness gates**:
  - each tagged PII column has class and handling rule
  - non-prod masking requirement is explicit
  - retention references are valid
  - privilege policy references restricted access for PII tables
- **Dependencies**: schema-ownership-policy
- **Downstream consumers**: role-privilege-policy, data-masking-policy, retention-archival-policy, audit-logging-policy
- **Error codes**: `DBA270`, `DBA271`, `DBA272`
- **Key invariant**: fail if sensitive columns are unclassified or lack handling controls.
- **Safe default**: no columns tagged, which should trigger review before production.

## 29. Audit Logging Policy

- **Name**: `audit-logging-policy`
- **Frequency**: per-project
- **Input**: privilege policy, compliance scope, incident requirements, PII rules
- **Output**: `database/audit-logging.policy.json`
- **Spec file**:
```json
{
  "events": ["login", "role_change", "ddl", "pii_select"],
  "retention_days": 365,
  "tamper_evident": true
}
```
- **Correctness gates**:
  - event classes are explicit
  - retention period is defined
  - privileged access and DDL are included
  - PII access logging exists if PII policy marks restricted data
- **Dependencies**: role-privilege-policy, pii-db-handling-policy
- **Downstream consumers**: security monitoring, incident response, retention policy
- **Cross-compiler checks**:
  - should align with security and compliance artifacts where present
- **Error codes**: `DBA280`, `DBA281`, `DBA282`
- **Key invariant**: fail if privileged or sensitive data access is unaudited.
- **Safe default**: log DDL and role changes only.

## 30. Disaster Recovery Spec

- **Name**: `disaster-recovery-spec`
- **Frequency**: per-project
- **Input**: RPO, RTO, region topology, backup policy, failover policy
- **Output**: `database/disaster-recovery.spec.json`
- **Spec file**:
```json
{
  "rpo_minutes": 15,
  "rto_minutes": 60,
  "recovery_modes": ["restore-from-backup", "promote-replica"],
  "priority_order": ["promote-replica", "restore-from-backup"]
}
```
- **Correctness gates**:
  - RPO and RTO are explicit
  - at least one recovery mode is declared
  - backup and failover references exist
  - restore verification criteria satisfy RPO and RTO targets
- **Dependencies**: backup-policy, restore-verification-spec, failover-policy
- **Downstream consumers**: restore-drill-report, incident automation
- **Edge cases covered**: RPO and RTO mismatches
- **Error codes**: `DBA290`, `DBA291`, `DBA292`
- **Key invariant**: fail if declared DR targets cannot be met by backup and failover controls.
- **Safe default**: document-only restore from latest verified backup.

## 31. Backup Verification Report

- **Name**: `backup-verification-report`
- **Frequency**: daily
- **Input**: executed backup metadata, backup policy, object store inventory
- **Output**: `database/backup-verification.report.json`
- **Spec file**:
```json
{
  "date": "2026-03-08",
  "checks": {
    "backup_completed": true,
    "retention_applied": true,
    "cross_region_copy_present": true
  }
}
```
- **Correctness gates**:
  - report references actual backup artifact IDs
  - completion, integrity, and retention checks are all present
  - policy deviations are explicit
  - backup age does not exceed policy schedule
- **Dependencies**: backup-policy
- **Downstream consumers**: disaster-recovery-spec, operational dashboards
- **Error codes**: `DBA300`, `DBA301`, `DBA302`
- **Key invariant**: fail if a daily report cannot prove that policy-required backups actually exist.
- **Safe default**: no report, treat backup state as unverified.

## 32. Restore Drill Report

- **Name**: `restore-drill-report`
- **Frequency**: per-incident
- **Input**: restore verification spec, backup artifacts, drill target, actual run outputs
- **Output**: `database/restore-drill.report.json`
- **Spec file**:
```json
{
  "drill_id": "restore-2026-03",
  "target": "point_in_time_minus_15m",
  "duration_minutes": 42,
  "integrity_checks_passed": true,
  "data_loss_minutes": 10
}
```
- **Correctness gates**:
  - drill references backup artifact and restore target
  - actual duration and data loss are recorded
  - integrity checks are attached
  - drill is pass only if within RPO and RTO
- **Dependencies**: restore-verification-spec, disaster-recovery-spec
- **Downstream consumers**: incident review, DR spec revisions
- **Error codes**: `DBA310`, `DBA311`, `DBA312`
- **Key invariant**: fail if drill outcome cannot be compared directly against DR targets.
- **Safe default**: no drill, DR remains unproven.

## 33. Data Integrity Validation Spec

- **Name**: `data-integrity-validation-spec`
- **Frequency**: per-project
- **Input**: critical tables, invariants, replication model, restoration requirements
- **Output**: `database/integrity-validation.spec.json`
- **Spec file**:
```json
{
  "checks": [
    { "name": "primary-key-uniqueness", "tables": ["users", "orders"] },
    { "name": "foreign-key-validity", "tables": ["orders"] },
    { "name": "row-count-sanity", "tables": ["users", "orders"], "delta_percent_max": 1.0 }
  ]
}
```
- **Correctness gates**:
  - every critical table has at least one integrity check
  - referential tables have FK validity checks unless explicitly denormalized
  - row-count or checksum sanity checks exist for restore validation
  - checks are machine-runnable
- **Dependencies**: schema-ownership-policy
- **Downstream consumers**: restore-verification-spec, healthcheck-spec
- **Error codes**: `DBA320`, `DBA321`, `DBA322`
- **Key invariant**: fail if critical data cannot be validated after restore or failover.
- **Safe default**: primary key uniqueness checks only.

## 34. Database Health Check Spec

- **Name**: `database-healthcheck-spec`
- **Frequency**: per-project
- **Input**: SLOs, topology, pool thresholds, lag thresholds, storage thresholds
- **Output**: `database/healthcheck.spec.json`
- **Spec file**:
```json
{
  "checks": {
    "connectivity": true,
    "replication_lag_seconds_max": 5,
    "pool_usage_percent_max": 80,
    "storage_percent_max": 85,
    "oldest_transaction_sec_max": 300
  },
  "states": {
    "ready": ["connectivity"],
    "degraded": ["replication-lag", "pool-high", "storage-high"],
    "unhealthy": ["connectivity-fail", "no-safe-failover"]
  }
}
```
- **Correctness gates**:
  - checks have numeric thresholds where applicable
  - readiness and degraded states are machine-declared
  - thresholds align with replication, pool, and storage policies
  - no health state relies on human interpretation only
- **Dependencies**: replication-topology-spec, connection-pool-policy, storage-growth-policy, long-running-transaction-policy
- **Downstream consumers**: monitoring, slow-query-analysis-report, incident automation
- **Cross-compiler checks**:
  - must expose a machine-checkable readiness and degradation model
- **Error codes**: `DBA330`, `DBA331`, `DBA332`
- **Key invariant**: fail if database health cannot be reduced to machine-checkable states.
- **Safe default**: connectivity-only check.

## 35. Materialized View Refresh Policy

- **Name**: `materialized-view-refresh-policy`
- **Frequency**: per-feature
- **Input**: materialized view inventory, freshness budget, lock constraints
- **Output**: `database/mview-refresh.policy.json`
- **Spec file**:
```json
{
  "views": {
    "daily_sales_mv": {
      "refresh_mode": "concurrent",
      "schedule": "0 * * * *",
      "staleness_minutes_max": 60
    }
  }
}
```
- **Correctness gates**:
  - every materialized view defines refresh mode and schedule
  - concurrent refresh requires supporting unique index
  - freshness budget is declared
  - refresh does not violate lock contention policy
- **Dependencies**: lock-contention-policy, maintenance-job-schedule
- **Downstream consumers**: analytics services, maintenance scheduler
- **Error codes**: `DBA340`, `DBA341`, `DBA342`
- **Key invariant**: fail if a materialized view lacks a bounded freshness and lock-safe refresh path.
- **Safe default**: disable materialized view refresh.

## 36. Maintenance Job Schedule

- **Name**: `maintenance-job-schedule`
- **Frequency**: per-project
- **Input**: vacuum policy, statistics policy, backup policy, mview policy, retention policy
- **Output**: `database/maintenance-jobs.schedule.json`
- **Spec file**:
```json
{
  "jobs": [
    { "name": "backup-check", "cron": "0 2 * * *", "artifact": "backup-verification-report" },
    { "name": "stats-refresh", "cron": "15 * * * *", "artifact": "statistics-refresh-policy" }
  ]
}
```
- **Correctness gates**:
  - every scheduled job references a source policy or report type
  - cron or interval is defined
  - mutually conflicting jobs are not scheduled in overlapping windows
  - production windows respect zero-downtime constraints
- **Dependencies**: backup-policy, vacuum-maintenance-policy, statistics-refresh-policy, materialized-view-refresh-policy, retention-archival-policy
- **Downstream consumers**: ops schedulers, healthcheck-spec
- **Error codes**: `DBA350`, `DBA351`, `DBA352`
- **Key invariant**: fail if required maintenance tasks have no schedule or conflict in execution windows.
- **Safe default**: schedule backup verification only.

## 37. Multi-tenant Isolation Rules

- **Name**: `multitenant-isolation-rules`
- **Frequency**: per-project
- **Input**: tenancy model, schema design, access matrix, PII constraints
- **Output**: `database/tenant-isolation.rules.json`
- **Spec file**:
```json
{
  "model": "shared-schema",
  "tenant_key": "tenant_id",
  "required_on_tables": ["orders", "invoices", "events"],
  "forbid_cross_tenant_reads": true
}
```
- **Correctness gates**:
  - tenancy model is declared
  - every tenant-scoped table lists tenant key requirement
  - cross-tenant read prohibition is explicit
  - read replica routing preserves isolation guarantees
- **Dependencies**: schema-ownership-policy, role-privilege-policy
- **Downstream consumers**: data-integrity-validation-spec, shard-placement-rules, security policy
- **Edge cases covered**: tenant isolation failures
- **Error codes**: `DBA360`, `DBA361`, `DBA362`
- **Key invariant**: fail if any tenant-scoped table can be queried without tenant boundary rules.
- **Safe default**: single-tenant assumption, no shared data paths.

## 38. Shard or Tenant Placement Rules

- **Name**: `shard-placement-rules`
- **Frequency**: per-feature
- **Input**: tenant size distribution, shard capacity, region rules, tenancy model
- **Output**: `database/shard-placement.rules.json`
- **Spec file**:
```json
{
  "placement_key": "tenant_id",
  "shards": [
    { "id": "shard-a", "capacity_score": 100, "regions": ["eu-central-1"] }
  ],
  "rebalance_threshold_percent": 80
}
```
- **Correctness gates**:
  - placement key is explicit
  - all shards define capacity score or cap
  - rebalance threshold is defined
  - placement respects tenant isolation and residency constraints
- **Dependencies**: multitenant-isolation-rules, capacity-forecast-report
- **Downstream consumers**: provisioning updates, routing layers
- **Error codes**: `DBA370`, `DBA371`, `DBA372`
- **Key invariant**: fail if tenant placement can violate capacity or isolation limits.
- **Safe default**: no sharding, all tenants on primary shard.

## 39. Schema Drift Detection Report

- **Name**: `schema-drift-report`
- **Frequency**: daily
- **Input**: environment schema snapshots, expected schema contract, migration history
- **Output**: `database/schema-drift.report.json`
- **Spec file**:
```json
{
  "baseline": "main-branch-schema",
  "environments": {
    "staging": { "drift": ["missing-index:orders_created_at_idx"] },
    "prod": { "drift": [] }
  }
}
```
- **Correctness gates**:
  - baseline is explicit
  - drift is computed for each environment
  - drift items are typed from controlled vocabulary
  - report distinguishes expected pending migrations from unexpected drift
- **Dependencies**: schema-ownership-policy, db-migration artifacts
- **Downstream consumers**: migration-execution-policy, incident review
- **Edge cases covered**: schema drift between environments
- **Error codes**: `DBA380`, `DBA381`, `DBA382`
- **Key invariant**: fail if production schema diverges from expected contract without typed explanation.
- **Safe default**: no drift report, environment parity remains unknown.

## 40. Lock Contention Policy

- **Name**: `lock-contention-policy`
- **Frequency**: per-project
- **Input**: migration windows, workload classes, lock budgets, table criticality
- **Output**: `database/lock-contention.policy.json`
- **Spec file**:
```json
{
  "lock_wait_ms_limit": 1000,
  "hot_tables": ["orders", "payments"],
  "forbid_access_exclusive_on_hot_tables": true,
  "maintenance_windows": {
    "prod": ["Sun 01:00-03:00 UTC"]
  }
}
```
- **Correctness gates**:
  - lock wait budget is defined
  - hot tables list exists
  - explicit rule exists for access exclusive locks on hot tables
  - maintenance windows are declared for production if required
- **Dependencies**: query-performance-budget-policy
- **Downstream consumers**: migration-execution-policy, materialized-view-refresh-policy, deadlock-handling-spec
- **Edge cases covered**: lock contention policies, zero-downtime maintenance windows
- **Error codes**: `DBA390`, `DBA391`, `DBA392`
- **Key invariant**: fail if hot tables can be blocked beyond declared lock budget.
- **Safe default**: forbid invasive locks on hot tables.

## 41. Deadlock Handling Spec

- **Name**: `deadlock-handling-spec`
- **Frequency**: per-project
- **Input**: timeout policy, workload classes, retry semantics, transaction classes
- **Output**: `database/deadlock-handling.spec.json`
- **Spec file**:
```json
{
  "detect_via": ["postgres_log", "error_code_40P01"],
  "retryable_classes": ["idempotent-write", "background-batch"],
  "max_retries": 2,
  "backoff_ms": 200
}
```
- **Correctness gates**:
  - detection source is defined
  - retryable classes are explicit and bounded
  - max retries is finite
  - non-idempotent classes are excluded from automatic retry
- **Dependencies**: timeout-transaction-policy, lock-contention-policy
- **Downstream consumers**: backend retry policy, incident handling, healthcheck-spec
- **Edge cases covered**: deadlock detection handling
- **Cross-compiler checks**:
  - should align with application retry behavior where applicable
- **Error codes**: `DBA400`, `DBA401`, `DBA402`
- **Key invariant**: fail if deadlocks can trigger unbounded or unsafe retries.
- **Safe default**: detect only, no automatic retry.

## 42. Long-running Transaction Policy

- **Name**: `long-running-transaction-policy`
- **Frequency**: per-project
- **Input**: transaction classes, vacuum budgets, replica lag policy, maintenance rules
- **Output**: `database/long-transactions.policy.json`
- **Spec file**:
```json
{
  "max_duration_sec": {
    "interactive": 30,
    "background": 300
  },
  "kill_if_idle_in_transaction_sec": 60,
  "alert_if_open_transaction_sec": 120
}
```
- **Correctness gates**:
  - duration limits are defined per transaction class
  - idle-in-transaction kill threshold exists
  - alert threshold is defined
  - thresholds are lower than vacuum starvation and replica lag risk limits
- **Dependencies**: timeout-transaction-policy, replication-topology-spec
- **Downstream consumers**: vacuum-maintenance-policy, healthcheck-spec, incident response
- **Edge cases covered**: long-running transactions, replica lag caused by old snapshots
- **Error codes**: `DBA410`, `DBA411`, `DBA412`
- **Key invariant**: fail if transactions may remain open long enough to block vacuum or destabilize replicas.
- **Safe default**: conservative short limits with alerts.

---

## Cross-Compiler Validation Matrix

These are the most important cross-compiler checks across the network.

### Existing compilers and shared artifacts

- `db-migration`
  - partitioning strategy must be compatible with migration plan shape
  - migration execution policy must constrain migration rollout mode
  - schema drift report compares actual schema against migration-derived schema
- `api-route`
  - connection environment contract should align with write and read connection usage
  - index advisory spec should map recommendations to known route or query usage where present
  - performance budget policy should map to route-level workload classes when available
- `auth-middleware`
  - privilege policy should align with service account and access boundaries where applicable
- shared `feature-flag`
  - seed/bootstrap policy must not inject production defaults that conflict with feature flags
- shared `i18n`
  - seed/bootstrap policy must not duplicate or overwrite locale bootstrap data ownership
- shared `analytics-event`
  - seed/bootstrap policy and retention policy must not corrupt analytics bootstrap or retention assumptions

### Internal DBA compiler cross-checks

- backup policy must reference retention policy and be satisfiable by provisioning spec
- restore verification spec must reference actual backup artifacts and data integrity checks
- failover policy must reject stale replica promotion beyond topology threshold
- healthcheck spec must reflect pool, lag, storage, and long-transaction thresholds from source policies
- data masking policy must fully cover PII policy in all non-production environments
- index advisory spec must not recommend indexes forbidden by index policy
- storage growth policy and capacity forecast must use retention assumptions from retention policy
- read replica routing policy must route consistency-sensitive reads to primary
- maintenance job schedule must cover all active maintenance policies
- audit logging policy must cover privileged access implied by privilege policy

---

## Recommended Build Order

The build order below optimizes for dependency readiness and highest operational value. It starts with foundational specs, then access and connection controls, then reliability controls, then daily analysis and incident proof artifacts.

### Phase 1. Foundation

1. `db-provisioning-spec`
2. `instance-sizing-policy`
3. `schema-ownership-policy`
4. `connection-env-contract`
5. `connection-pool-policy`
6. `pool-proxy-config`

### Phase 2. Access and Data Governance

7. `pii-db-handling-policy`
8. `role-privilege-policy`
9. `db-user-provisioning-manifest`
10. `data-masking-policy`
11. `audit-logging-policy`
12. `seed-bootstrap-data-policy`
13. `multitenant-isolation-rules`

### Phase 3. Performance and Query Safety

14. `timeout-transaction-policy`
15. `query-performance-budget-policy`
16. `lock-contention-policy`
17. `deadlock-handling-spec`
18. `long-running-transaction-policy`
19. `index-policy`
20. `partitioning-strategy-spec`
21. `vacuum-maintenance-policy`
22. `statistics-refresh-policy`
23. `materialized-view-refresh-policy`

### Phase 4. Storage, Retention, and Capacity

24. `retention-archival-policy`
25. `storage-growth-policy`
26. `capacity-forecast-report`
27. `shard-placement-rules`

### Phase 5. Reliability and Recovery

28. `backup-policy`
29. `data-integrity-validation-spec`
30. `restore-verification-spec`
31. `replication-topology-spec`
32. `read-replica-routing-policy`
33. `failover-policy`
34. `disaster-recovery-spec`
35. `database-healthcheck-spec`
36. `maintenance-job-schedule`

### Phase 6. Daily and Continuous Analysis

37. `slow-query-analysis-report`
38. `index-advisory-spec`
39. `schema-drift-report`
40. `backup-verification-report`

### Phase 7. Incident and Proof-of-Recovery

41. `restore-drill-report`

## Must-exist dependencies before others can be built

- `db-provisioning-spec` must exist before sizing, topology, backup, and connection compilers
- `schema-ownership-policy` must exist before privilege, migration execution, and bootstrap data compilers
- `pii-db-handling-policy` must exist before masking, retention, and audit policy compilers
- `connection-pool-policy` and `connection-env-contract` must exist before proxy config and health checks
- `query-performance-budget-policy` must exist before slow query and index advisory compilers
- `retention-archival-policy` must exist before partitioning and storage growth policies can be trusted
- `backup-policy` plus `data-integrity-validation-spec` must exist before restore verification can be built
- `replication-topology-spec` must exist before read routing, failover, and replication-aware health checks
- `restore-verification-spec` plus `failover-policy` plus `backup-policy` must exist before DR spec is complete
- `database-healthcheck-spec` should exist before daily operational analysis compilers rely on shared degradation thresholds

This build order gives you a compiler network that starts with foundational correctness, then enforces access and performance invariants, then proves recoverability and day-2 operational reliability.
