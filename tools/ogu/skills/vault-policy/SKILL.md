---
name: vault-policy
description: Compiler skill for the vault_policy compiler. Activates when producing vault-policy-artifact.json. Gates: VP001–VP008. No upstream dependency.
---

# vault-policy — Compiler Skill

## What This Compiler Does

Compiles the HashiCorp Vault policy specification — path rules, capability allowlists, wildcard path restrictions, least-privilege enforcement, and role bindings. Enforces: paths stay within allowed prefixes, wildcard paths require explicit exceptions, capabilities are from the valid set, `sudo` requires justification, `deny` cannot be mixed with other capabilities, and every role has a service account or app binding.

**Upstream dependency:** none
**Output artifact:** `vault-policy-artifact.json`
**IR identifier:** `VAULT_POLICY:{project}`

---

## Spec Shape

```json
{
  "name": "api-service-policy",
  "paths": [
    {
      "path": "secret/data/api/+",
      "capabilities": ["read"],
      "wildcardException": "Reads all API secrets by key name — bounded to secret/data/api/ prefix"
    },
    {
      "path": "kv/data/shared/config",
      "capabilities": ["read", "list"]
    },
    {
      "path": "auth/token/lookup-self",
      "capabilities": ["read"]
    }
  ],
  "roles": [
    {
      "name": "api-service",
      "serviceAccount": "api-service-sa",
      "namespace": "production",
      "tokenPolicy": "api-service-policy"
    }
  ]
}
```

Required fields:
- `name` — policy name
- `paths` — non-empty array, each with `path` and `capabilities`
- `roles` — array of role bindings

---

## Gates

### VP001 — spec-valid
Reads `vault-policy-spec.json`. Required: `name`, `paths` (non-empty array). Each path needs `path` and `capabilities` (non-empty array).

Hard-fails if `vault-policy-spec.json` is missing.

### VP002 — paths-in-allowed-prefix
All path values must start with an allowed prefix. Default allowed prefixes: `secret/`, `kv/`, `auth/`, `pki/`, `transit/`, `database/`, `aws/`, `gcp/`, `azure/`.

Custom allowed prefixes can be declared in `spec.allowedPrefixes`.

BAD:
```json
{ "paths": [{ "path": "prod/secret/db", "capabilities": ["read"] }] }
// "prod/" is not an allowed prefix
```
GOOD:
```json
{ "paths": [{ "path": "secret/data/db", "capabilities": ["read"] }] }
```

### VP003 — no-wildcard-paths
Paths containing `*` or `+` (Vault glob patterns) must declare a `wildcardException` field explaining why broad access is needed. Wildcard paths grant access to all sub-paths matching the pattern.

BAD:
```json
{ "paths": [{ "path": "secret/data/*", "capabilities": ["read"] }] }
// wildcard with no exception documented
```
GOOD:
```json
{
  "paths": [{
    "path": "secret/data/*",
    "capabilities": ["read"],
    "wildcardException": "CI pipeline reads all secrets for deployment — bounded by role TTL of 15min"
  }]
}
```

### VP004 — capabilities-allowed
Each capability must be one of: `create`, `read`, `update`, `delete`, `list`, `patch`, `sudo`, `deny`.

BAD:
```json
{ "capabilities": ["read", "write"] }
// "write" is not a valid Vault capability — use "update"
```
GOOD:
```json
{ "capabilities": ["read", "list"] }
```

### VP005 — least-privilege
- `sudo` capability requires a `justification` field on the path entry — `sudo` bypasses most Vault access controls
- `deny` cannot be combined with other capabilities — a path that is both `read` and `deny` has undefined behavior

BAD:
```json
{ "path": "sys/mounts", "capabilities": ["sudo"] }
// sudo without justification
```
```json
{ "path": "secret/data/old", "capabilities": ["deny", "read"] }
// deny mixed with read
```
GOOD:
```json
{
  "path": "sys/mounts",
  "capabilities": ["sudo"],
  "justification": "Needed by the vault-admin role to mount new secret engines"
}
```
```json
{ "path": "secret/data/deprecated", "capabilities": ["deny"] }
// deny alone is valid
```

### VP006 — roles-declared
Each role in `roles` must declare:
- `name` — role name
- At least one of: `serviceAccount`, `tokenPolicy`, or `appRole` binding

Roles without bindings cannot be assigned to any identity.

BAD:
```json
{ "roles": [{ "name": "api-role" }] }
// no serviceAccount, tokenPolicy, or appRole
```
GOOD:
```json
{ "roles": [{ "name": "api-role", "serviceAccount": "api-sa", "tokenPolicy": "api-policy" }] }
```

### VP007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### VP008 — contract-vault
Final contract check: policy `name` must be declared and non-empty. All paths must have non-empty `capabilities` arrays.

---

## What This Compiler Never Forgives

- `vault-policy-spec.json` missing (VP001 hard-fails)
- `name` or `paths` missing (VP001)
- `paths` empty (VP001)
- Any path missing `path` or `capabilities` (VP001)
- Path prefix not in allowed list (VP002)
- Wildcard path (`*` or `+`) without `wildcardException` (VP003)
- Capability not in valid list (VP004)
- `sudo` capability without `justification` (VP005)
- `deny` combined with other capabilities (VP005)
- Role missing `serviceAccount`, `tokenPolicy`, and `appRole` (VP006)
