---
name: audit-log-policy
description: Compiler skill for the audit-log-policy compiler. Activates when producing audit-log-policy.json. Gates: AL001–AL006. Upstream: threat-model.compiled.json.
---

# audit-log-policy — Compiler Skill

## What This Compiler Does

Compiles the audit log policy for a feature or service. Enforces that the log schema includes all six required fields, no raw PII appears in log payloads, all high-risk actions are explicitly logged, and a retention period is declared.

**Upstream dependency:** `threat-model.compiled.json`
**Output artifact:** `audit-log-policy.compiled.json`
**Spec file you write:** `audit-log-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-management",
  "retention_days": 365,
  "schema": {
    "required_fields": ["event_id", "timestamp", "actor_id", "action", "resource", "outcome"]
  },
  "actions": [
    {
      "id": "user.create",
      "description": "User account creation",
      "risk_level": "high",
      "logged": true,
      "pii_in_payload": false
    },
    {
      "id": "user.delete",
      "description": "User account deletion",
      "risk_level": "high",
      "logged": true,
      "pii_in_payload": false
    },
    {
      "id": "user.login",
      "description": "User authentication event",
      "risk_level": "high",
      "logged": true,
      "pii_in_payload": false
    },
    {
      "id": "report.read",
      "description": "Read dashboard report",
      "risk_level": "standard",
      "logged": true,
      "pii_in_payload": false
    }
  ]
}
```

---

## Gates

### AL001 — spec-valid
Reads `audit-log-policy.json`. Skips (pass) if file absent.

Required top-level fields: `schema` (object), `actions` (non-empty array), `retention_days` (positive number).

### AL002 — required-fields-in-schema
`schema.required_fields` must be an array containing all six of these (camelCase and snake_case variants are both accepted):

```
event_id   (or eventId)
timestamp
actor_id   (or actorId)
action
resource
outcome
```

BAD: `"required_fields": ["timestamp", "action"]` — missing 4 of 6.
GOOD: all six present.

### AL003 — no-pii-in-logs
Every action entry must set `"pii_in_payload": false`. Setting `pii_in_payload: true` means raw PII is emitted to the audit log.

BAD: `{ "id": "user.create", "pii_in_payload": true }`.
GOOD: `"pii_in_payload": false` for all actions. Log a user ID or hashed value; never a plaintext email, name, or SSN.

### AL004 — high-risk-actions-logged
Actions with `risk_level: "high"` must have `logged: true`. The gate also checks actions whose `id` or `description` matches high-risk keywords (delete, admin, auth, login, reset, permission, role) and flags them if they are not marked as high-risk and logged.

BAD: `{ "id": "user.delete", "risk_level": "high", "logged": false }`.
GOOD: all `risk_level: "high"` actions have `logged: true`.

### AL005 — retention-defined
`retention_days` must be a positive number.

BAD: no `retention_days` field.
BAD: `"retention_days": 0`.
GOOD: `"retention_days": 365`.

### AL006 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `audit-log-policy.json`.

---

## What This Compiler Never Forgives

- Missing any of the six required schema fields
- Any action with `pii_in_payload: true`
- High-risk actions (delete, admin, auth events) with `logged: false`
- Missing `retention_days`
