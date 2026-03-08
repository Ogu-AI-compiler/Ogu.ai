# PII Classification Compiler

## Role

Produce a `pii-classification.json` that maps every sensitive data field to its classification level, logging policy, encryption requirements, and applicable privacy regulation jurisdictions.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `pii-classification.json` | Phase 2 | The classification manifest — validated by all gates |
| `pii-classification.compiled.json` | Phase 5 | Compiler attestation — written on full pass |

## Spec Shape

```json
{
  "project": "string — project or service name",
  "fields": [
    {
      "id": "string — unique kebab-case id (e.g. users.email)",
      "entity": "string — table or model name (e.g. users)",
      "field_name": "string — column or field name (e.g. email)",
      "description": "string — what this field stores",
      "classification_level": "public | internal | sensitive | highly_sensitive",
      "is_pii": true,
      "jurisdictions": ["gdpr", "ccpa"],
      "log_handling": "mask | exclude | hash | truncate | redact",
      "log_in_plaintext": false,
      "storage_encrypted": true,
      "encryption_key_ref": "string — secret id from secret-handling-policy (required for highly_sensitive)"
    }
  ]
}
```

## Classification Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| `public` | Freely shareable | Public username, avatar URL |
| `internal` | Internal use only | Internal user ID, role name |
| `sensitive` | Personal data, restricted | Email, phone, address |
| `highly_sensitive` | High risk if exposed | SSN, credit card, health data, passwords |

## Hard Gates

### PC003 — highly_sensitive must declare encryption
Any field with `classification_level: "highly_sensitive"` must declare:
- `storage_encrypted: true`
- `encryption_key_ref`: a string referencing a key id in the secret-handling-policy

### PC004 — sensitive/highly_sensitive must restrict logging
Fields with `sensitive` or `highly_sensitive` classification must:
- Set `log_handling` to one of: `mask`, `exclude`, `hash`, `truncate`, `redact`
- Must NOT set `log_in_plaintext: true`

### PC006 — PII fields need jurisdictions
Fields with `is_pii: true` must declare a non-empty `jurisdictions` array. Valid values: `gdpr`, `ccpa`, `hipaa`, `pipeda`, `lgpd`, `pdpa`, `global`.

## Contract (Gold Standard)

```json
{
  "project": "user-service",
  "fields": [
    {
      "id": "users.username",
      "entity": "users",
      "field_name": "username",
      "description": "Public display name",
      "classification_level": "public",
      "is_pii": false,
      "log_handling": "mask",
      "log_in_plaintext": false,
      "storage_encrypted": false
    },
    {
      "id": "users.email",
      "entity": "users",
      "field_name": "email",
      "description": "User email address for login and communication",
      "classification_level": "sensitive",
      "is_pii": true,
      "jurisdictions": ["gdpr", "ccpa"],
      "log_handling": "mask",
      "log_in_plaintext": false,
      "storage_encrypted": false
    },
    {
      "id": "users.ssn",
      "entity": "users",
      "field_name": "ssn",
      "description": "Social security number for identity verification",
      "classification_level": "highly_sensitive",
      "is_pii": true,
      "jurisdictions": ["ccpa", "hipaa"],
      "log_handling": "exclude",
      "log_in_plaintext": false,
      "storage_encrypted": true,
      "encryption_key_ref": "user-pii-encryption-key"
    }
  ]
}
```

## What You Never Do

- Never leave `classification_level` blank or use a non-standard value
- Never set `log_in_plaintext: true` for sensitive or highly_sensitive fields
- Never omit `encryption_key_ref` for `highly_sensitive` fields
- Never omit `jurisdictions` for PII fields (`is_pii: true`)
- Never duplicate field ids within the manifest
