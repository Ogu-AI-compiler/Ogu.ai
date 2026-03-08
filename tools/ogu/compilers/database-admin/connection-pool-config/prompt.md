# connection-pool-config Compiler

## Role
Produce a valid connection pool policy (PgBouncer or equivalent) that safely multiplexes application connections to PostgreSQL without ever exhausting `max_connections`.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `connection-pool-config.json` | Phase 0 | Declare pool policy |
| `connection-pool-config-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "pool_mode": "transaction",
  "max_client_connections": 2000,
  "default_pool_size": 20,
  "reserve_pool_size": 5,
  "server_idle_timeout": 600,
  "auth_type": "scram-sha-256",
  "health_check_query": "SELECT 1",
  "max_db_connections": 100,
  "reserved_system_connections": 3,
  "pools": [
    {
      "name": "app_write",
      "database": "myapp",
      "user": "app_writer",
      "pool_size": 20
    },
    {
      "name": "app_read",
      "database": "myapp",
      "user": "app_reader",
      "pool_size": 10
    }
  ]
}
```

**Field reference:**
- `pool_mode`: `session` | `transaction` | `statement`
- `max_db_connections`: from `db-provisioning-spec` — the PostgreSQL instance's `max_connections`
- `pools[].pool_size`: overrides `default_pool_size` per pool
- `reserved_system_connections`: defaults to 3 if omitted

## Hard Gates

### CPC003 — Pool sizes must not exceed max_connections
**BAD:**
```json
{ "max_db_connections": 100, "pools": [{"pool_size": 80}, {"pool_size": 30}], "reserve_pool_size": 5 }
```
Total: 80+30+5 = 115 > 100. REJECTED.

**GOOD:**
```json
{ "max_db_connections": 100, "pools": [{"pool_size": 40}, {"pool_size": 30}], "reserve_pool_size": 5 }
```
Total: 40+30+5 = 75 <= 97 (100-3 reserved). PASSES.

### CPC005 — auth_type must be scram-sha-256
**BAD:** `"auth_type": "md5"` — deprecated, offline-crackable
**GOOD:** `"auth_type": "scram-sha-256"`

### CPC007 — reserve_pool_size must be > 0
**BAD:** `"reserve_pool_size": 0` — hard-rejects clients on full pool
**GOOD:** `"reserve_pool_size": 5`

## Contract (Gold Standard — passes all gates)

```json
{
  "pool_mode": "transaction",
  "max_client_connections": 5000,
  "default_pool_size": 25,
  "reserve_pool_size": 10,
  "server_idle_timeout": 600,
  "auth_type": "scram-sha-256",
  "health_check_query": "SELECT 1",
  "max_db_connections": 200,
  "reserved_system_connections": 3,
  "pools": [
    { "name": "api_pool", "database": "myapp", "user": "api_user", "pool_size": 80 },
    { "name": "worker_pool", "database": "myapp", "user": "worker_user", "pool_size": 40 }
  ]
}
```
Check: 80+40+10 = 130 <= 197 (200-3). max_client_connections 5000 > 120. ✓

## What You Never Do

- Never set `auth_type` to `md5`, `password`, or `trust`
- Never let total pool sizes + reserve exceed `max_db_connections - 3`
- Never set `reserve_pool_size` to 0
- Never set `server_idle_timeout` to 0 or omit it
- Never omit `health_check_query`
- Never use `pool_mode: "statement"` for apps that use multi-statement transactions
