---
name: authz-policy
description: Compiler skill for the authz-policy compiler. Activates when producing authz-policy.json. Gates: AZ001–AZ008. Upstream: threat-model.compiled.json.
---

# authz-policy — Compiler Skill

## What This Compiler Does

Compiles the authorization policy for an API or feature. Enforces default-deny posture, no wildcard allows in production, no unauthenticated admin access, multi-tenant data isolation, scoped M2M actors, and isolated admin roles. Downstream compilers `rate-limit-policy` and `session-cookie-policy` read this artifact.

**Upstream dependency:** `threat-model.compiled.json`
**Output artifact:** `authz-policy.compiled.json`
**Spec file you write:** `authz-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-dashboard",
  "default_effect": "deny",
  "multi_tenant": true,
  "roles": [
    { "id": "admin",           "name": "Administrator" },
    { "id": "viewer",          "name": "Viewer" },
    { "id": "internal-worker", "name": "Internal Worker Service" }
  ],
  "rules": [
    {
      "id": "rule-admin-manage-users",
      "subject": "admin",
      "resource": "users",
      "action": "manage",
      "effect": "allow",
      "tenant_scoped": true,
      "conditions": { "tenant_id": "${actor.tenant_id}" }
    },
    {
      "id": "rule-viewer-read-reports",
      "subject": "viewer",
      "resource": "reports",
      "action": "read",
      "effect": "allow"
    },
    {
      "id": "rule-default-deny",
      "subject": "*",
      "resource": "*",
      "action": "*",
      "effect": "deny"
    }
  ]
}
```

---

## Gates

### AZ001 — spec-valid
Reads `authz-policy.json`. Skips (pass) if file absent.

Required top-level fields: `feature` (string), `roles` (non-empty array), `rules` (non-empty array).

Required per-rule fields: `id`, `subject`, `resource`, `action`, `effect`. `effect` must be `"allow"` or `"deny"` (case-insensitive).

BAD: rule missing `subject` → gate fails naming the index and rule ID.
GOOD: every rule has all five fields; effect is exactly `"allow"` or `"deny"`.

### AZ002 — default-deny-exists
The policy must declare a default-deny posture in one of two ways:

1. `"default_effect": "deny"` at the top level, OR
2. A rule with `subject: "*"` (or `"all"` / `"any"`), `resource: "*"`, `action: "*"`, `effect: "deny"`.

Both forms are accepted. If neither exists, the gate fails.

BAD: policy with only allow rules, no `default_effect` field.
GOOD: `"default_effect": "deny"` at root level.

### AZ003 — no-wildcard-in-prod-allow
Allow rules must not use wildcards (`*`, `all`, `any`, `everything`) for `resource` or `action`.

Escape hatch: set `"wildcard_ok": true` on the rule to skip this check for that rule.

BAD: `{ "effect": "allow", "resource": "*", "action": "read" }`.
BAD: `{ "effect": "allow", "resource": "users", "action": "*" }`.
GOOD: `{ "effect": "allow", "resource": "users", "action": "read" }`.
ESCAPE: `{ "effect": "allow", "resource": "*", "wildcard_ok": true }` — skipped.

### AZ004 — no-unauthenticated-admin
Allow rules whose `subject` is one of `unauthenticated`, `anonymous`, `guest`, `public`, `*`, `anyone` must not grant admin-tier operations. Admin-tier is detected by matching these keywords in the combined `resource + action` string: `admin`, `delete`, `create`, `write`, `update`, `patch`, `destroy`, `manage`, `configure`.

BAD: `{ "subject": "public", "action": "delete", "resource": "users", "effect": "allow" }`.
GOOD: public subjects may only have read-only, non-destructive access.

### AZ005 — multitenant-isolation
Applies **only** when `"multi_tenant": true` is set. For every allow rule where `rule.tenant_scoped === true` OR `rule.resource` contains `"tenant"`, the `conditions` object must reference `tenant_id`, `tenant-id`, or `org_id`.

BAD (multi-tenant): `{ "resource": "tenant-data", "effect": "allow", "conditions": {} }`.
GOOD: `"conditions": { "tenant_id": "${actor.tenant_id}" }`.
Skips entirely if `multi_tenant` is absent or false.

### AZ006 — m2m-actors-scoped
Roles with names containing `service`, `machine`, `bot`, `daemon`, `worker`, `cron`, `internal`, or `system` are M2M roles. They must not:
- Inherit from user roles (`inherits_from`, `extends`, or `parent_role` pointing to a name containing `user`, `member`, `customer`, `end-user`).
- Have permissions containing `ui`, `dashboard`, or `frontend`.

BAD: `{ "name": "internal-worker", "inherits_from": "user" }`.
GOOD: `{ "id": "internal-worker", "name": "Internal Worker Service" }` — standalone, no inheritance.

### AZ007 — admin-role-isolated
Admin roles must not inherit from regular user roles. The `inherits_from`, `extends`, or `parent_role` field on any role named `admin` must not point to a non-admin role.

BAD: admin role with `"inherits_from": "viewer"`.
GOOD: admin role declared independently with no inheritance from user-tier roles.

### AZ008 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `authz-policy.json`.

---

## What This Compiler Never Forgives

- Missing `default_effect: "deny"` and no equivalent wildcard deny rule
- Wildcard allow rules without `wildcard_ok: true`
- Admin-tier operations (`delete`, `manage`, `configure`) granted to unauthenticated subjects
- Multi-tenant features with tenant-scoped allow rules that lack a `tenant_id` condition
