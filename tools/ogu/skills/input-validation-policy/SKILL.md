---
name: input-validation-policy
description: Compiler skill for the input-validation-policy compiler. Activates when producing input-validation-policy.json. Gates: IV001–IV007. Upstream: threat-model.compiled.json.
---

# input-validation-policy — Compiler Skill

## What This Compiler Does

Compiles input validation rules for all API fields in a feature. Enforces that string fields have `maxLength`, numeric fields have bounds, high-risk fields declare a sanitization strategy, no field is left unvalidated, and file fields are restricted to safe extensions and sizes. The `file-upload-policy` compiler reads this artifact.

**Upstream dependency:** `threat-model.compiled.json`
**Output artifact:** `input-validation-policy.compiled.json`
**Spec file you write:** `input-validation-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-profile-update",
  "fields": [
    {
      "id": "username",
      "name": "Username",
      "type": "string",
      "maxLength": 50,
      "minLength": 3,
      "sanitization": "none"
    },
    {
      "id": "website_url",
      "name": "Website URL",
      "type": "url",
      "maxLength": 2048,
      "high_risk": true,
      "sanitization": "urlValidate"
    },
    {
      "id": "bio",
      "name": "Biography",
      "type": "string",
      "maxLength": 500,
      "sanitization": "none"
    },
    {
      "id": "age",
      "name": "Age",
      "type": "integer",
      "min": 13,
      "max": 150
    },
    {
      "id": "avatar",
      "name": "Avatar Image",
      "type": "file",
      "allowedExtensions": [".jpg", ".jpeg", ".png", ".webp"],
      "maxSizeBytes": 5242880
    }
  ]
}
```

---

## Gates

### IV001 — spec-valid
Reads `input-validation-policy.json`. Skips (pass) if file absent.

Required top-level fields: `feature` (string), `fields` (non-empty array).

Required per-field fields: `id`, `name`, `type`.

### IV002 — string-fields-have-maxlength
Every field with `type` of `string`, `text`, `email`, `url`, or `textarea` must declare a `maxLength` as a positive number.

BAD: `{ "id": "notes", "type": "string" }` → no `maxLength`.
GOOD: `{ "id": "notes", "type": "string", "maxLength": 1000 }`.

### IV003 — numeric-fields-have-bounds
Every field with `type` of `integer`, `number`, `float`, or `decimal` must declare both `min` and `max`.

BAD: `{ "id": "price", "type": "number" }` → no `min`/`max`.
GOOD: `{ "id": "price", "type": "number", "min": 0, "max": 999999 }`.

### IV004 — high-risk-fields-have-sanitization
Fields marked `"high_risk": true` OR with `type` in `["url", "html", "richtext", "sql"]` must declare a `sanitization` field. Any non-empty string is accepted as the value.

Common valid values: `escape`, `htmlEncode`, `urlValidate`, `parameterize`, `strip`.

BAD: `{ "id": "content", "type": "html", "high_risk": true }` → no `sanitization`.
GOOD: `{ "id": "content", "type": "html", "high_risk": true, "sanitization": "htmlEncode" }`.

### IV005 — no-unvalidated-fields
Every field must have at least one constraint: `maxLength`, `min`, `max`, `allowedExtensions`, `pattern`, `enum`, or `sanitization`. A field with only `id`, `name`, `type` and nothing else is unvalidated.

BAD: `{ "id": "nickname", "name": "Nickname", "type": "string" }` → no constraints.
GOOD: Add at least one constraint, e.g. `"maxLength": 30`.

Escape hatch: `"validation_ok": true` on the field — skips this check for that field.

### IV006 — file-fields-restricted
Fields with `"type": "file"` must declare both:
- `allowedExtensions`: non-empty array of extension strings (e.g. `[".jpg", ".png"]`)
- `maxSizeBytes`: positive number

BAD: `{ "id": "attachment", "type": "file" }` → no extension list, no size limit.
GOOD: `{ "id": "attachment", "type": "file", "allowedExtensions": [".pdf"], "maxSizeBytes": 10485760 }`.

### IV007 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `input-validation-policy.json`.

---

## What This Compiler Never Forgives

- String fields without `maxLength` — enables DoS via oversized payloads
- File fields without `allowedExtensions` and `maxSizeBytes` — unrestricted upload
- High-risk fields (`html`, `url`, SQL-interpolated) without a declared `sanitization` strategy
- Fields with only `id`/`name`/`type` and no constraints (use `validation_ok: true` if intentional)
