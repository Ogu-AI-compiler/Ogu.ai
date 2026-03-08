---
name: connection-pool-config
description: Compiler skill for the connection_pool_config compiler. Activates when producing connection-pool-artifact.json. Gates: CP001–CP007. No upstream dependency.
---

# connection-pool-config — Compiler Skill

## What This Compiler Does

Compiles the database connection pool configuration — pooler type, client connection limits, pool sizing, authentication, TLS mode, and host references. Enforces: all limits are positive integers, `maxClientConn` ≥ `poolSize` with headroom, auth type and TLS mode are valid values, host/DSN fields use environment variable references (not literal values), and TLS disable requires justification.

**Upstream dependency:** none
**Output artifact:** `connection-pool-artifact.json`
**IR identifier:** `CONNECTION_POOL:{project}`

---

## Spec Shape

```json
{
  "pooler": "pgbouncer",
  "maxClientConn": 200,
  "poolSize": 20,
  "host": "${DB_HOST}",
  "port": 5432,
  "database": "${DB_NAME}",
  "authType": "scram-sha-256",
  "tlsMode": "require",
  "poolMode": "transaction",
  "failoverPolicy": "reconnect"
}
```

Required fields:
- `pooler` — connection pooler name
- `maxClientConn` — maximum client connections (positive integer)
- `poolSize` — pool size per database/user pair (positive integer)
- `host` — database host (must use env var reference)

---

## Gates

### CP001 — spec-valid
Reads `connection-pool-spec.json`. Required: `pooler`, `maxClientConn`, `poolSize`, `host`. All must be present and correctly typed.

Hard-fails if `connection-pool-spec.json` is missing.

### CP002 — limits-positive
`maxClientConn`, `poolSize`, and `maxConnections` (if declared) must all be positive integers. Zero or negative values cause the pooler to reject all connections at startup.

BAD:
```json
{ "maxClientConn": 0, "poolSize": -1 }
```
GOOD:
```json
{ "maxClientConn": 200, "poolSize": 20 }
```

### CP003 — client-conn-sufficient
`maxClientConn` must be ≥ `poolSize` and provide at least 10% headroom above `poolSize`. If `maxClientConn` equals `poolSize`, new clients are immediately rejected when all pool slots are occupied.

Escape: set `skipHeadroomCheck: true` to bypass the 10% headroom check.

BAD:
```json
{ "maxClientConn": 20, "poolSize": 20 }
// no headroom — clients rejected at full pool
```
GOOD:
```json
{ "maxClientConn": 200, "poolSize": 20 }
// 10x headroom
```

### CP004 — auth-tls-valid
`authType` must be one of: `md5`, `scram-sha-256`, `trust`, `peer`, `cert`, `password`.
`tlsMode` must be one of: `require`, `prefer`, `disable`, `verify-ca`, `verify-full`.

BAD:
```json
{ "authType": "plain-text", "tlsMode": "off" }
```
GOOD:
```json
{ "authType": "scram-sha-256", "tlsMode": "require" }
```

### CP005 — host-refs-declared
The `host`, `dsn`, and related connection fields must use environment variable references — not literal hostnames or connection strings. Literal values expose infrastructure topology and get committed to source control.

Required pattern: `${VAR_NAME}` syntax.

BAD:
```json
{ "host": "db.internal.example.com" }
{ "dsn": "postgres://user:pass@db-host:5432/mydb" }
```
GOOD:
```json
{ "host": "${DB_HOST}", "dsn": "${DATABASE_URL}" }
```

### CP006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### CP007 — contract-pool
Final contract checks:
- `tlsMode: "disable"` requires a `disableTlsJustification` field explaining why TLS is disabled
- `failoverPolicy` must be declared — poolers without failover configuration have undefined behavior on primary loss

BAD:
```json
{ "tlsMode": "disable" }
// no justification for disabling TLS
```
GOOD:
```json
{
  "tlsMode": "disable",
  "disableTlsJustification": "Internal VPC network — TLS terminated at load balancer",
  "failoverPolicy": "reconnect"
}
```

---

## What This Compiler Never Forgives

- `connection-pool-spec.json` missing (CP001 hard-fails)
- `pooler`, `maxClientConn`, `poolSize`, or `host` missing (CP001)
- `maxClientConn`, `poolSize`, or `maxConnections` is 0 or negative (CP002)
- `maxClientConn` < `poolSize` (CP003)
- Less than 10% headroom between `maxClientConn` and `poolSize` without `skipHeadroomCheck` (CP003)
- `authType` not in valid list (CP004)
- `tlsMode` not in valid list (CP004)
- `host`/`dsn` using literal values instead of env var references (CP005)
- `tlsMode: "disable"` without `disableTlsJustification` (CP007)
- `failoverPolicy` not declared (CP007)
