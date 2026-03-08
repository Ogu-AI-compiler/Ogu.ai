---
name: secret-handling-policy
description: Compiler skill for the secret-handling-policy compiler. Activates when producing secret-handling-policy.json. Gates: SH001–SH008. No upstream dependency.
---

# secret-handling-policy — Compiler Skill

## What This Compiler Does

Compiles the secret management policy for a project. Enforces that production secrets use proper backends (not env vars), rotation schedules are defined, secrets are masked from logs, consumers are scoped to minimum access, staging and production environments use separate secrets, and no hardcoded values appear in the spec. The `encryption-key-policy` and `webhook-verification-policy` compilers read this artifact.

**Upstream dependency:** none
**Output artifact:** `secret-handling-policy.compiled.json`
**Spec file you write:** `secret-handling-policy.json`

---

## Spec Shape

```json
{
  "project": "my-saas-app",
  "secrets": [
    {
      "id": "db-password-prod",
      "type": "database_credential",
      "storage_backend": "vault",
      "environments": ["prod"],
      "max_age_days": 90,
      "rotation_required": true,
      "log_safe": false,
      "allowed_consumers": ["api-service", "migration-runner"]
    },
    {
      "id": "db-password-staging",
      "type": "database_credential",
      "storage_backend": "vault",
      "environments": ["staging"],
      "max_age_days": 90,
      "rotation_required": true,
      "log_safe": false,
      "allowed_consumers": ["api-service"]
    },
    {
      "id": "stripe-api-key",
      "type": "third_party_api_key",
      "storage_backend": "aws_secrets_manager",
      "environments": ["prod"],
      "max_age_days": 365,
      "rotation_required": false,
      "log_safe": false,
      "allowed_consumers": ["payment-service"]
    }
  ]
}
```

---

## Gates

### SH001 — spec-valid
Reads `secret-handling-policy.json`. Skips (pass) if file absent.

Required top-level fields: `project` (string), `secrets` (non-empty array).

Required per-secret fields: `id` (string), `type` (string), `storage_backend` (string), `environments` (array), `max_age_days` (positive number), `rotation_required` (boolean), `log_safe` (boolean), `allowed_consumers` (array).

### SH002 — no-env-vars-prod
Any secret with `"prod"` or `"production"` in its `environments` array must not use `storage_backend` values of `"env_var"`, `"environment_variable"`, or `"env"`.

BAD: `{ "storage_backend": "env_var", "environments": ["prod"] }`.
GOOD: `"storage_backend": "vault"` for any prod secret.

### SH003 — rotation-defined
Secrets with `rotation_required: true` must have a positive `max_age_days`. (This pairs with SH001 which already requires `max_age_days`, but SH003 enforces the logical link between the two fields.)

### SH004 — no-plaintext-logging
Secrets containing sensitive values must have `"log_safe": false`. Setting `log_safe: true` declares the value may appear in logs — only valid for non-sensitive public identifiers.

BAD: `{ "type": "database_credential", "log_safe": true }`.
GOOD: `"log_safe": false` for all passwords, tokens, keys.

### SH005 — consumers-scoped
`allowed_consumers` must be a non-empty array. An empty array means any service can access the secret.

BAD: `"allowed_consumers": []`.
GOOD: `"allowed_consumers": ["payment-service"]`.

### SH006 — staging-prod-separation
No single secret entry may list both staging and production in `environments`. Staging and prod must be separate entries with separate IDs.

BAD: `{ "id": "db-password", "environments": ["staging", "prod"] }`.
GOOD: Two entries — `"db-password-staging"` (environments: ["staging"]) and `"db-password-prod"` (environments: ["prod"]).

### SH007 — no-hardcoded-values
The spec must not contain fields like `value`, `password`, `token`, `key`, `secret` with actual credential strings embedded. Reference secrets by `id` only.

BAD: `"value": "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ"` — hardcoded token.
GOOD: No `value` field. The spec names and scopes secrets; it does not store them.

### SH008 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `secret-handling-policy.json`.

---

## What This Compiler Never Forgives

- `storage_backend: "env_var"` for any secret in prod
- `allowed_consumers: []` — open access
- A single entry spanning both staging and prod in `environments`
- Any field in the spec containing an actual credential value
