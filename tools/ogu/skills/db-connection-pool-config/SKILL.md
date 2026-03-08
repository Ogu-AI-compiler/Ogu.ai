---
name: db-connection-pool-config
description: Compiler skill for the database-admin connection-pool-config compiler. Activates when producing connection-pool-config-artifact.json. Gates: CPC001–CPC008. No upstream dependency.
---

# db-connection-pool-config — Compiler Skill

## What This Compiler Does

Compiles the database connection pool configuration — PgBouncer pool mode, client connection limits, per-database pool sizes, reserve pool, server idle timeout, authentication type, and health check query. Enforces: pool mode is a valid PgBouncer mode, total pool size does not exceed available database connections, max client connections exceeds total pool size (queuing invariant), auth type is `scram-sha-256` only, health check query is declared, reserve pool is non-zero, and idle timeout is at least 30 seconds.

**Upstream dependency:** none
**Output artifact:** `connection-pool-config-artifact.json`
**IR identifier:** `CONNECTION_POOL_CONFIG:{project}`

---

## Spec Shape

```json
{
  "pool_mode": "transaction",
  "max_client_connections": 1000,
  "default_pool_size": 20,
  "reserve_pool_size": 5,
  "server_idle_timeout": 600,
  "auth_type": "scram-sha-256",
  "health_check_query": "SELECT 1",
  "max_db_connections": 100,
  "pools": [
    { "name": "app", "pool_size": 20 },
    { "name": "analytics", "pool_size": 5 }
  ]
}
```

Required fields:
- `pool_mode` — `session`, `transaction`, or `statement`
- `max_client_connections` — positive integer
- `default_pool_size` — positive integer
- `reserve_pool_size` — positive integer (> 0)
- `server_idle_timeout` — seconds (≥ 30)
- `auth_type` — authentication method
- `health_check_query` — non-empty SQL string
- `max_db_connections` — total database connection limit
- `pools` — non-empty array, each with `name` and `pool_size`

---

## Gates

### CPC001 — spec-valid
Reads `connection-pool-config.json`. Hard-fails if file missing. Required: `pool_mode`, `max_client_connections`, `default_pool_size`, `reserve_pool_size`, `server_idle_timeout`, `auth_type`, `health_check_query`, `max_db_connections`, `pools` (non-empty array of objects with `name` and `pool_size`).

BAD: Any required field missing.
GOOD: All fields present with valid types.

### CPC002 — pool-mode
`pool_mode` must be one of: `session`, `transaction`, `statement`.

- `session` — connection held for entire client session (safest, least efficient)
- `transaction` — connection returned after each transaction (recommended for most apps)
- `statement` — connection returned after each statement (requires autocommit, cannot use multi-statement transactions)

BAD:
```json
{ "pool_mode": "persistent" }
{ "pool_mode": "auto" }
```
GOOD:
```json
{ "pool_mode": "transaction" }
```

### CPC003 — pool-size-limit
The sum of all `pools[].pool_size` values plus `reserve_pool_size` must not exceed `max_db_connections - 3`. The 3 reserved connections are kept for monitoring, replication, and superuser access.

Formula: `sum(pools[].pool_size) + reserve_pool_size ≤ max_db_connections - 3`

BAD:
```json
{
  "max_db_connections": 100,
  "reserve_pool_size": 5,
  "pools": [
    { "name": "app", "pool_size": 80 },
    { "name": "analytics", "pool_size": 20 }
  ]
}
// 80 + 20 + 5 = 105 > 100 - 3 = 97 — oversubscribed
```
GOOD:
```json
{
  "max_db_connections": 100,
  "reserve_pool_size": 5,
  "pools": [
    { "name": "app", "pool_size": 60 },
    { "name": "analytics", "pool_size": 10 }
  ]
}
// 60 + 10 + 5 = 75 ≤ 97 — within limit
```

### CPC004 — max-client-connections
`max_client_connections` must be strictly greater than the sum of all `pools[].pool_size` values. This invariant ensures clients can queue when all pool connections are busy rather than being immediately rejected.

Formula: `max_client_connections > sum(pools[].pool_size)`

BAD:
```json
{
  "max_client_connections": 25,
  "pools": [
    { "name": "app", "pool_size": 20 },
    { "name": "analytics", "pool_size": 10 }
  ]
}
// 25 ≤ 30 — clients rejected instead of queued
```
GOOD:
```json
{
  "max_client_connections": 1000,
  "pools": [
    { "name": "app", "pool_size": 20 },
    { "name": "analytics", "pool_size": 5 }
  ]
}
// 1000 > 25 — clients queue safely
```

### CPC005 — auth-type
`auth_type` must be `scram-sha-256`. All other authentication methods are rejected:

- `md5` — deprecated, rainbow-table vulnerable
- `password` — plaintext, never acceptable
- `trust` — no authentication at all
- `ident` — OS-level, not suitable for connection pooler
- `peer` — Unix socket only, not suitable for pooler

BAD:
```json
{ "auth_type": "md5" }
{ "auth_type": "trust" }
{ "auth_type": "password" }
```
GOOD:
```json
{ "auth_type": "scram-sha-256" }
```

### CPC006 — health-check-query
`health_check_query` must be declared and non-empty. PgBouncer uses this query to verify backend connections before handing them to clients. A missing health check allows broken connections to reach application code.

Recommended: `"SELECT 1"` — fastest possible query with zero side effects.

BAD: `health_check_query` missing or empty string `""`.
GOOD:
```json
{ "health_check_query": "SELECT 1" }
```

### CPC007 — reserve-pool
`reserve_pool_size` must be greater than 0. The reserve pool provides emergency connections for bursts that exceed normal pool capacity. A zero reserve means no burst headroom — connection queues spike during traffic peaks.

BAD:
```json
{ "reserve_pool_size": 0 }
// no emergency capacity
```
GOOD:
```json
{ "reserve_pool_size": 5 }
```

### CPC008 — idle-timeout
`server_idle_timeout` must be greater than 0 and at least 30 seconds.

- `0` — connections never closed; idle connections accumulate and exhaust database limits
- `< 30` — connections recycled too aggressively; causes churn and connection establishment overhead on every burst

Recommended: 300–600 seconds (5–10 minutes) for typical OLTP workloads.

BAD:
```json
{ "server_idle_timeout": 0 }   // infinite — connections never released
{ "server_idle_timeout": 10 }  // 10s — too aggressive, causes churn
```
GOOD:
```json
{ "server_idle_timeout": 600 }  // 10 minutes — reasonable for OLTP
```

---

## What This Compiler Never Forgives

- `connection-pool-config.json` missing (CPC001 hard-fails)
- Any required field missing: `pool_mode`, `max_client_connections`, `default_pool_size`, `reserve_pool_size`, `server_idle_timeout`, `auth_type`, `health_check_query`, `max_db_connections`, `pools` (CPC001)
- `pools` empty array (CPC001)
- `pool_mode` not `session`, `transaction`, or `statement` (CPC002)
- Pool sizes + reserve exceed `max_db_connections - 3` (CPC003)
- `max_client_connections` ≤ total pool size (CPC004)
- `auth_type` is `md5`, `password`, `trust`, `ident`, or `peer` (CPC005)
- `health_check_query` missing or empty (CPC006)
- `reserve_pool_size: 0` — no emergency connections (CPC007)
- `server_idle_timeout: 0` — connections never released (CPC008)
- `server_idle_timeout < 30` — excessive connection churn (CPC008)
