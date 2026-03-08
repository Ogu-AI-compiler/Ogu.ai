# connection-string-contract Compiler

## Role
Produce a validated connection string contract that maps every service × every environment to a database connection definition with no embedded credentials and proper SSL.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `connection-string-contract.json` | Phase 0 | Declare connection contracts |
| `connection-string-contract-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "format": "uri",
  "connect_timeout": 10,
  "environments": ["local", "staging", "production"],
  "services": [
    {
      "name": "api-service",
      "environments": [
        {
          "env": "local",
          "host": "localhost",
          "port": 5432,
          "database": "myapp",
          "user": "api_local",
          "password": "${DB_PASSWORD_LOCAL}",
          "sslmode": "disable",
          "connect_timeout": 5
        },
        {
          "env": "staging",
          "host": "staging-db.internal",
          "port": 6432,
          "database": "myapp",
          "user": "api_staging",
          "password": "${DB_PASSWORD_STAGING}",
          "sslmode": "require",
          "connect_timeout": 10
        },
        {
          "env": "production",
          "host": "prod-db.internal",
          "port": 6432,
          "database": "myapp",
          "user": "api_prod",
          "password": "${DB_PASSWORD_PROD}",
          "sslmode": "verify-full",
          "connect_timeout": 10
        }
      ]
    }
  ]
}
```

## Hard Gates

### CSC002 — No literal passwords
**BAD:** `"password": "mysecretpassword123"`
**BAD:** `"connection_string": "postgres://api:mysecret@host/db"`
**GOOD:** `"password": "${DB_PASSWORD_PROD}"`
**GOOD:** `"password": "{{vault:secret/db/prod}}"`

### CSC003 — SSL required for non-local
**BAD:** `{ "env": "production", "sslmode": "disable" }`
**GOOD:** `{ "env": "production", "sslmode": "verify-full" }`

### CSC005 — Per-service isolation
**BAD:** Both `api-service` and `worker-service` use `user: "app_user"` in production.
**GOOD:** `api-service` uses `api_prod`, `worker-service` uses `worker_prod`.

## What You Never Do

- Never embed a literal password in any field or connection string URI
- Never use `sslmode: "disable"` or `"prefer"` for staging or production
- Never share database users across services
- Never omit `connect_timeout`
- Never mix URI and DSN formats in the same spec
- Never leave a service without a host entry for any declared environment
