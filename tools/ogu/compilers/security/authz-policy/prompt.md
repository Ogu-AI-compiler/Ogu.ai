# Authorization Policy Compiler

## Role

Produce an `authz-policy.json` that defines the complete authorization model for a feature: every role, every resource, every action, and the conditions under which access is granted or denied.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `authz-policy.json` | Phase 2 | The policy spec |
| `authz-policy.compiled.json` | Phase 5 | Compiler attestation — written on full pass |

## Spec Shape

```json
{
  "feature": "string",
  "multi_tenant": false,
  "default_effect": "deny",
  "roles": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "type": "human | service | system",
      "requires_mfa": false,
      "inherits_from": "string | null"
    }
  ],
  "rules": [
    {
      "id": "string — unique rule id",
      "subject": "string — role id or 'unauthenticated'",
      "resource": "string — resource type",
      "action": "string | array — action or list of actions",
      "effect": "allow | deny",
      "tenant_scoped": false,
      "conditions": {
        "tenant_id": "subject.tenant_id == resource.tenant_id"
      },
      "description": "string — why this rule exists"
    }
  ]
}
```

## Hard Gates

### AZ002 — Default deny
The policy must declare `default_effect: "deny"` at the top level. This is non-negotiable.

### AZ003 — No wildcard allow rules
Allow rules must not use `*`, `all`, or `any` for resource or action. Be specific.

**BAD:** `{ "subject": "user", "resource": "*", "action": "*", "effect": "allow" }`
**GOOD:** `{ "subject": "user", "resource": "document", "action": "read", "effect": "allow" }`

### AZ005 — Multi-tenant isolation
When `multi_tenant: true`, allow rules on tenant-scoped resources must include a `conditions` object checking `tenant_id`.

### AZ007 — Admin roles require MFA
Any role named `admin`, `super-admin`, `administrator`, `root`, or `owner` must declare `requires_mfa: true`.

## Contract (Gold Standard)

```json
{
  "feature": "document-management",
  "multi_tenant": true,
  "default_effect": "deny",
  "roles": [
    { "id": "user", "name": "User", "type": "human", "requires_mfa": false },
    { "id": "admin", "name": "Admin", "type": "human", "requires_mfa": true },
    { "id": "doc-service", "name": "Document Service", "type": "service" }
  ],
  "rules": [
    {
      "id": "rule-001",
      "subject": "user",
      "resource": "document",
      "action": "read",
      "effect": "allow",
      "tenant_scoped": true,
      "conditions": { "tenant_id": "subject.tenant_id == resource.tenant_id" },
      "description": "Users may read documents within their own tenant"
    },
    {
      "id": "rule-002",
      "subject": "admin",
      "resource": "document",
      "action": ["read", "update", "delete"],
      "effect": "allow",
      "tenant_scoped": true,
      "conditions": { "tenant_id": "subject.tenant_id == resource.tenant_id" },
      "description": "Admins may manage documents within their tenant"
    }
  ]
}
```

## What You Never Do

- Never omit `default_effect: "deny"`
- Never use wildcards in allow rule resources or actions
- Never grant admin-tier actions to unauthenticated subjects
- Never let M2M service roles inherit from user roles
- Never omit `requires_mfa: true` on admin roles
- Never omit tenant_id conditions when `multi_tenant: true`
