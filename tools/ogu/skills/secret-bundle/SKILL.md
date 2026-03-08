---
name: secret-bundle
description: Compiler skill for the secret_bundle compiler. Activates when producing secret-bundle-artifact.json. Gates: SB001–SB007. No upstream dependency.
---

# secret-bundle — Compiler Skill

## What This Compiler Does

Compiles the secret bundle specification — secret sources, namespace isolation, plaintext detection, path format validation, rotation policy, and cross-artifact env schema alignment. Enforces: every secret has a valid source, no duplicate names within namespace+environment, no plaintext YAML `stringData` values, secret paths match source-specific format rules, and rotation policy is declared.

**Upstream dependency:** none
**Output artifact:** `secret-bundle-artifact.json`
**IR identifier:** `SECRET_BUNDLE:{project}`

---

## Spec Shape

```json
{
  "namespace": "production",
  "environments": ["staging", "production"],
  "rotationPolicy": "90d",
  "secrets": [
    {
      "name": "database-credentials",
      "envKey": "DATABASE_URL",
      "source": "aws-secrets-manager",
      "path": "arn:aws:secretsmanager:us-east-1:123456789:secret:prod/db-url"
    },
    {
      "name": "api-key",
      "envKey": "STRIPE_API_KEY",
      "source": "vault",
      "path": "secret/stripe/api-key"
    }
  ]
}
```

Required fields:
- `secrets` — non-empty array, each with `name`, `envKey`, `source`, `path`
- `namespace` — Kubernetes namespace
- `environments` — non-empty array

Valid sources: `aws-secrets-manager`, `gcp-secret-manager`, `azure-key-vault`, `vault`, `k8s-secret`, `sealed-secret`

---

## Gates

### SB001 — spec-valid
Reads `secret-bundle-spec.json`. Required: `secrets` (non-empty array), `namespace`, `environments`. Each secret needs `name`, `envKey`, `source` (valid), `path`.

Hard-fails if `secret-bundle-spec.json` is missing.

### SB002 — keys-mapped-to-env
Cross-artifact gate: if `env-schema-artifact.json` exists, every secret's `envKey` must be declared in the env schema with `secret: true`. This ensures secrets are documented in the schema and not injected silently.

Without an env schema artifact, performs a basic check that `envKey` is a non-empty string.

BAD: `envKey: "DATABASE_URL"` but `env-schema-artifact.json` declares `DATABASE_URL` with `secret: false`.
GOOD: `envKey` matches a key in env schema with `secret: true`.

### SB003 — namespace-unique
No two secrets may share the same `name` within the same namespace + environment combination. Duplicate secret names cause Kubernetes to silently overwrite.

BAD:
```json
{ "secrets": [
  { "name": "db-creds", "envKey": "DB_URL", "source": "vault", "path": "secret/db" },
  { "name": "db-creds", "envKey": "DB_PASS", "source": "vault", "path": "secret/db-pass" }
]}
// duplicate name "db-creds"
```
GOOD: All secret names are unique within namespace.

### SB004 — no-plaintext-values
Scans YAML files in the directory for Kubernetes `Secret` objects with `stringData` containing literal values. Plaintext secrets in YAML files get committed to source control.

BAD:
```yaml
kind: Secret
stringData:
  DATABASE_PASSWORD: "super-secret-password"
```
GOOD: Use sealed-secrets, External Secrets Operator, or vault-agent — never literal values.

### SB005 — secret-paths-valid
`path` format is validated per source:
- `aws-secrets-manager` — AWS ARN (`arn:aws:secretsmanager:...`) or simple name
- `gcp-secret-manager` — `projects/{project}/secrets/{name}/versions/{version}`
- `azure-key-vault` — vault URL (`https://{vault}.vault.azure.net/secrets/{name}`)
- `vault` — path matching `[a-zA-Z0-9_/-]+` (no leading slash)
- `k8s-secret` — `{namespace}/{name}` format
- `sealed-secret` — skipped (format is tool-specific)

BAD:
```json
{ "source": "vault", "path": "/secret/db" }
// leading slash not allowed for vault paths
```
```json
{ "source": "gcp-secret-manager", "path": "my-secret" }
// not a full GCP resource path
```
GOOD:
```json
{ "source": "vault", "path": "secret/prod/db-url" }
{ "source": "gcp-secret-manager", "path": "projects/my-project/secrets/db-url/versions/latest" }
```

### SB006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### SB007 — contract-bundle
Final contract checks:
- `rotationPolicy` must be declared — secrets without rotation are permanent credentials. Valid values: `30d`, `90d`, `180d`, `1y`, `manual`, `never`
- `environments` must be declared
- All secret `name` values must be unique (global, not just per-namespace)

BAD:
```json
{ "namespace": "production", "environments": ["production"], "secrets": [...] }
// no rotationPolicy
```
GOOD:
```json
{ "rotationPolicy": "90d" }
```

---

## What This Compiler Never Forgives

- `secret-bundle-spec.json` missing (SB001 hard-fails)
- `secrets`, `namespace`, or `environments` missing (SB001)
- `secrets` empty (SB001)
- Any secret missing `name`, `envKey`, `source`, or `path` (SB001)
- `source` not in valid list (SB001)
- `envKey` not in env schema or not marked `secret: true` when schema exists (SB002)
- Duplicate secret names within namespace (SB003)
- Plaintext `stringData` values in committed YAML files (SB004)
- `path` format invalid for the declared `source` (SB005)
- `rotationPolicy` not declared (SB007)
- `environments` not declared (SB007)
