---
name: connection-string-contract
description: Compiler skill for the connection-string-contract compiler. Activates when producing connection-string-artifact.json. Gates: CSC001–CSC007. Hard-fails when spec missing.
---

# connection-string-contract — Compiler Skill

## What This Compiler Does

Compiles database connection string contracts — validates spec structure (environments, services, format), blocks literal passwords embedded in connection strings (requires vault/env-var references), enforces SSL mode requirements for non-local environments, requires host declarations for every environment per service, detects shared database users across services, requires connect timeout declarations, and validates that all connection strings use the declared format consistently (URI or DSN).

**Upstream dependency:** none
**Output artifact:** `connection-string-artifact.json`
**IR identifier:** `CONNECTION_STRING_CONTRACT:{project}`

---

## Spec Shape

**`connection-string-contract.json`**:
```json
{
  "format":       "uri",
  "environments": ["local", "staging", "production"],
  "connect_timeout": 10,
  "services": [
    {
      "name": "api-service",
      "environments": [
        {
          "env":      "local",
          "host":     "localhost",
          "port":     5432,
          "user":     "api_local",
          "password": "${DB_PASSWORD_LOCAL}",
          "sslmode":  "disable"
        },
        {
          "env":      "staging",
          "host":     "db-staging.internal",
          "port":     5432,
          "user":     "api_staging",
          "password": "${DB_PASSWORD_STAGING}",
          "sslmode":  "verify-full"
        },
        {
          "env":      "production",
          "host":     "db-prod.internal",
          "port":     5432,
          "user":     "api_prod",
          "password": "{{vault:secret/db/api/password}}",
          "sslmode":  "verify-full"
        }
      ]
    }
  ]
}
```

Required fields:
- `environments` — non-empty array
- `services` — non-empty array
- `format` — `"uri"` or `"dsn"`

---

## Gates

### CSC001 — spec-valid
Reads `connection-string-contract.json`. Hard-fails if missing. Required: `environments` (non-empty array), `services` (non-empty array), `format` (`"uri"` or `"dsn"`).

BAD: spec missing or `format: "postgres"` (invalid) or `services: []`.
GOOD: all three fields present with valid types.

### CSC002 — no-literal-passwords
No service/environment entry may contain a literal password value. Passwords must use environment variable placeholders (`${ENV_VAR}`, `$ENV_VAR`) or vault references (`{{vault:path}}`). Connection string URIs with embedded passwords are also blocked.

BAD:
```json
{ "user": "api", "password": "mypassword123" }
// Literal password — will appear in git history and CI logs
```
BAD:
```json
{ "connection_string": "postgres://api:mypassword123@db.internal/mydb" }
// Embedded password in URI
```
GOOD:
```json
{ "user": "api", "password": "${DB_PASSWORD}" }
{ "user": "api", "password": "{{vault:secret/db/api/password}}" }
{ "connection_string": "postgres://api:${DB_PASSWORD}@db.internal/mydb" }
```
Escape: `"comment": "// @literal-password-ok"` on the entry (for test environments with known dummy credentials).

### CSC003 — ssl-mode
Non-local environments must declare `sslmode` as one of: `"require"`, `"verify-full"`, `"verify-ca"`. Values `"disable"`, `"prefer"`, and `"allow"` are rejected for non-local environments as they allow plaintext connections vulnerable to MITM attacks.

Local environments (`local`, `localhost`, `dev-local`, `development-local`) are exempt.

BAD:
```json
{ "env": "staging", "sslmode": "disable" }
// Disabling SSL in staging — plaintext connections to staging DB
{ "env": "production" }
// sslmode not declared for production
```
GOOD:
```json
{ "env": "staging",    "sslmode": "verify-full" }
{ "env": "production", "sslmode": "verify-full" }
{ "env": "local",      "sslmode": "disable" }
// Local environment is exempt
```

### CSC004 — host-per-env
Every environment declared in `spec.environments` must have a corresponding entry in each service's `environments` array, with a `host` or `connection_string` declared. Missing host entries cause silent fallback to wrong-environment databases.

BAD:
```json
{
  "environments": ["local", "staging", "production"],
  "services": [{
    "name": "api",
    "environments": [
      { "env": "local",   "host": "localhost" },
      { "env": "staging", "host": "db-staging.internal" }
    ]
  }]
}
// "production" environment missing from service "api"
```
GOOD: Every service has entries for all declared environments, each with `host` or `connection_string`.

### CSC005 — per-service-isolation
No two services may share the same database user for the same environment. Shared credentials mean a breach of one service exposes all services sharing those credentials.

BAD:
```json
{
  "services": [
    { "name": "api",     "environments": [{ "env": "production", "user": "app_user" }] },
    { "name": "worker",  "environments": [{ "env": "production", "user": "app_user" }] }
  ]
}
// Both services use "app_user" in production — shared credentials
```
GOOD:
```json
{
  "services": [
    { "name": "api",    "environments": [{ "env": "production", "user": "api_prod" }] },
    { "name": "worker", "environments": [{ "env": "production", "user": "worker_prod" }] }
  ]
}
```

### CSC006 — connect-timeout
`connect_timeout` must be declared at the spec level (applies globally) or per environment entry, with a value ≥ 1 second. Without a connect timeout, applications hang indefinitely when the database is unreachable, causing request pile-ups and cascading failures.

BAD:
```json
{
  "services": [{
    "name": "api",
    "environments": [{ "env": "production", "host": "db.internal" }]
  }]
}
// No connect_timeout at spec level or environment level
```
GOOD:
```json
{ "connect_timeout": 10 }
// Global timeout of 10 seconds applies to all environments

// OR per environment:
{ "env": "production", "host": "db.internal", "connect_timeout": 5 }
```

### CSC007 — format-consistent
All `connection_string` values in the spec must match the declared `format`. Mixing URI (`postgres://...`) and DSN (`host=... dbname=...`) formats causes inconsistent parsing across services.

BAD:
```json
{
  "format": "uri",
  "services": [{
    "environments": [{
      "connection_string": "host=db.internal dbname=mydb user=api"
    }]
  }]
}
// DSN format but spec declares "uri"
```
GOOD:
```json
{
  "format": "uri",
  "services": [{
    "environments": [{
      "connection_string": "postgres://api:${DB_PASSWORD}@db.internal/mydb"
    }]
  }]
}
```

---

## What This Compiler Never Forgives

- `connection-string-contract.json` missing (CSC001 hard-fails)
- `environments`, `services`, or `format` missing (CSC001)
- `environments` or `services` empty arrays (CSC001)
- `format` not `"uri"` or `"dsn"` (CSC001)
- Literal password in any `password` field or embedded in URI (CSC002)
- Non-local environment with `sslmode: "disable"`, `"prefer"`, or `"allow"` (CSC003)
- Non-local environment with no `sslmode` declared (CSC003)
- Any declared environment missing a host entry for any service (CSC004)
- Two services sharing the same database user for the same environment (CSC005)
- No `connect_timeout` at spec or environment level (CSC006)
- `connect_timeout < 1` (CSC006)
- `connection_string` format inconsistent with declared `spec.format` (CSC007)
