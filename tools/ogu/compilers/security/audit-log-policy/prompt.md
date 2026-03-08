# Audit Log Policy Compiler

## Role

Produce an `audit-log-policy.json` that defines which security-relevant actions are audited, the required schema for every log entry, PII masking rules, and data retention.

## Spec Shape

```json
{
  "feature": "string",
  "retention_days": 365,
  "schema": {
    "actor_id": { "type": "string", "required": true },
    "timestamp": { "type": "ISO8601", "required": true },
    "source_ip": { "type": "string", "required": true },
    "action_result": { "type": "enum", "values": ["success", "failure", "error"], "required": true },
    "resource_id": { "type": "string" },
    "email": { "type": "string", "is_pii": true, "mask": true }
  },
  "events": [
    {
      "action": "user.delete",
      "sensitivity": "high | medium | low",
      "logged_fields": [
        { "name": "actor_id", "mask": false },
        { "name": "email", "mask": true }
      ]
    }
  ]
}
```

## Hard Gates

- Schema must include: `actor_id`, `timestamp`, `source_ip`, `action_result`
- PII fields (email, phone, SSN, etc.) must have `mask: true`
- `retention_days` must be ≥ 90
- delete, login, permission_change must be covered (for features with >3 events)
