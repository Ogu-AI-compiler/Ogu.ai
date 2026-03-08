---
name: pii-classification
description: Compiler skill for the pii-classification compiler. Activates when producing pii-classification.json. Gates: PC001–PC007. No upstream dependency.
---

# pii-classification — Compiler Skill

## What This Compiler Does

Compiles the PII classification manifest for a data schema. Enforces that every field has a classification level, highly-sensitive fields are encrypted at rest, sensitive fields are restricted from logging, field IDs are unique, and PII fields declare applicable jurisdiction (GDPR, CCPA, HIPAA, etc.).

**Upstream dependency:** none
**Output artifact:** `pii-classification.compiled.json`
**Spec file you write:** `pii-classification.json`

---

## Spec Shape

```json
{
  "project": "user-profile-service",
  "fields": [
    {
      "id": "user.email",
      "entity": "User",
      "field_name": "email",
      "classification_level": "sensitive",
      "encrypted_at_rest": false,
      "log_restricted": true,
      "jurisdictions": ["GDPR", "CCPA"]
    },
    {
      "id": "user.ssn",
      "entity": "User",
      "field_name": "social_security_number",
      "classification_level": "highly_sensitive",
      "encrypted_at_rest": true,
      "log_restricted": true,
      "jurisdictions": ["CCPA", "HIPAA"]
    },
    {
      "id": "user.username",
      "entity": "User",
      "field_name": "username",
      "classification_level": "internal",
      "encrypted_at_rest": false,
      "log_restricted": false,
      "jurisdictions": []
    }
  ]
}
```

---

## Valid Classification Levels (exact strings, case-sensitive)

```
public
internal
sensitive
highly_sensitive
```

Any other value — including `"high"`, `"medium"`, `"low"`, `"pii"` — fails PC001.

---

## Gates

### PC001 — spec-valid
Reads `pii-classification.json`. Skips (pass) if file absent.

Required top-level fields: `project` (string), `fields` (non-empty array).

Required per-field fields: `id`, `entity`, `field_name`, `classification_level`. `classification_level` must be one of the four valid levels.

BAD: `"classification_level": "high"` — not in the enum (must be `"highly_sensitive"`).
GOOD: `"classification_level": "highly_sensitive"`.

### PC002 — all-fields-classified
Every field in `fields[]` must have a `classification_level` set to a valid level. No field may be unclassified.

### PC003 — highly-sensitive-encrypted
Fields with `"classification_level": "highly_sensitive"` must set `"encrypted_at_rest": true`.

BAD: `{ "classification_level": "highly_sensitive", "encrypted_at_rest": false }`.
GOOD: `{ "classification_level": "highly_sensitive", "encrypted_at_rest": true }`.

Examples that are always `highly_sensitive`: SSN, payment card number, biometric data, health records, government ID.

### PC004 — sensitive-logging-restricted
Fields with `classification_level` of `"sensitive"` or `"highly_sensitive"` must set `"log_restricted": true`.

BAD: `{ "classification_level": "sensitive", "log_restricted": false }`.
GOOD: `{ "classification_level": "sensitive", "log_restricted": true }`.

### PC005 — no-duplicate-field-ids
Every `id` in `fields[]` must be unique. Convention: use `"entity.field_name"` format (e.g. `"user.email"`).

BAD: two entries with `"id": "user.email"`.
GOOD: each field has a unique ID.

### PC006 — pii-fields-have-jurisdiction
Fields with `classification_level` of `"sensitive"` or `"highly_sensitive"` must have a non-empty `jurisdictions` array. Fields classified `"public"` or `"internal"` may have an empty array.

BAD: `{ "classification_level": "sensitive", "jurisdictions": [] }`.
GOOD: `{ "classification_level": "sensitive", "jurisdictions": ["GDPR", "CCPA"] }`.

### PC007 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `pii-classification.json`.

---

## What This Compiler Never Forgives

- `classification_level` outside the four valid values (especially `"high"` instead of `"highly_sensitive"`)
- `highly_sensitive` field without `encrypted_at_rest: true`
- `sensitive` or `highly_sensitive` field with `log_restricted: false`
- Sensitive fields with no `jurisdictions` declared
- Duplicate field IDs
