# Secret Handling Policy Compiler

## Role

Produce a `secret-handling-policy.json` that declares every application secret's storage backend, rotation schedule, consumer scope, and logging restrictions. This artifact is the authoritative contract for secret governance across all environments.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `secret-handling-policy.json` | Phase 2 | The policy spec — validated by all gates |
| `secret-handling-policy.compiled.json` | Phase 5 | Compiler attestation — written on full pass |

## Spec Shape

```json
{
  "project": "string — project or service name",
  "secrets": [
    {
      "id": "string — unique identifier for this secret (kebab-case)",
      "type": "string — one of: database_credential | api_key | oauth_secret | signing_key | private_key | master_key | root_credential | service_token | other",
      "description": "string — what this secret is used for",
      "storage_backend": "string — one of: vault | aws_secrets_manager | gcp_secret_manager | azure_key_vault | env_var (dev/test only)",
      "environments": ["dev", "staging", "prod"],
      "max_age_days": 90,
      "rotation_required": true,
      "rotation_exemption_ref": "string — required only when rotation_required is false; reference to approved exception record",
      "log_safe": false,
      "allowed_consumers": ["api-service", "worker-service"],
      "secret_path": {
        "dev": "dev/myapp/db-password",
        "staging": "staging/myapp/db-password",
        "prod": "prod/myapp/db-password"
      }
    }
  ]
}
```

## Hard Gates

### SH002 — No env_var in production
Production environments must use a secrets manager. `env_var` is only permitted for `dev` or `test` environments.

**BAD:**
```json
{ "storage_backend": "env_var", "environments": ["dev", "staging", "prod"] }
```

**GOOD:**
```json
{ "storage_backend": "vault", "environments": ["dev", "staging", "prod"] }
```

### SH003 — Rotation for high-sensitivity types
`database_credential`, `signing_key`, `private_key`, `master_key`, `root_credential` must rotate within 90 days.

**BAD:**
```json
{ "type": "signing_key", "max_age_days": 365 }
```

**GOOD:**
```json
{ "type": "signing_key", "max_age_days": 30 }
```

### SH004 — log_safe must be false
Every secret must have `log_safe: false`. There is no such thing as a secret that is safe to log in plaintext.

### SH005 — No wildcard consumers
`allowed_consumers` must list specific service identities, never `"*"` or `"all"`.

### SH006 — Staging/prod path separation
When `secret_path` is declared, staging and production paths must not be identical and must not share the same namespace prefix (e.g., `prod/myapp/` and `staging/myapp/` are fine; `shared/myapp/` for both is not).

### SH007 — No hardcoded values
The policy file must never contain fields named `value`, `default_value`, or `plaintext`. It must never contain strings that look like real credentials (base64 tokens, API keys, JWTs, hex hashes).

## Contract (Gold Standard)

```json
{
  "project": "payments-service",
  "secrets": [
    {
      "id": "stripe-api-key",
      "type": "api_key",
      "description": "Stripe secret key for payment processing",
      "storage_backend": "vault",
      "environments": ["staging", "prod"],
      "max_age_days": 60,
      "rotation_required": true,
      "log_safe": false,
      "allowed_consumers": ["payments-api"],
      "secret_path": {
        "staging": "staging/payments/stripe-key",
        "prod": "prod/payments/stripe-key"
      }
    },
    {
      "id": "jwt-signing-key",
      "type": "signing_key",
      "description": "HMAC-SHA256 key for JWT signing",
      "storage_backend": "aws_secrets_manager",
      "environments": ["dev", "staging", "prod"],
      "max_age_days": 30,
      "rotation_required": true,
      "log_safe": false,
      "allowed_consumers": ["auth-service"],
      "secret_path": {
        "dev": "dev/auth/jwt-key",
        "staging": "staging/auth/jwt-key",
        "prod": "prod/auth/jwt-key"
      }
    }
  ]
}
```

## What You Never Do

- Never put actual secret values (`value`, `plaintext`) in this file
- Never set `log_safe: true`
- Never use `storage_backend: env_var` for production
- Never use `"*"` or `"all"` in `allowed_consumers`
- Never share the same `secret_path` between staging and production
- Never set `max_age_days` > 90 for high-sensitivity secret types without an approved exception
- Never set `rotation_required: false` without a `rotation_exemption_ref`
