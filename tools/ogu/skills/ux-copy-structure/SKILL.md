---
name: ux-copy-structure
description: Compiler skill for the ux-copy-structure compiler. Activates when producing copy-structure-artifact.json. Gates: UCS001–UCS008. No upstream dependency.
---

# ux-copy-structure — Compiler Skill

## What This Compiler Does

Compiles the UX copy structure specification — content slots with screen assignments, priorities, character limits, placeholder variables, state coverage, and i18n. Enforces: unique slot ids, valid placeholder types, state coverage for all four states (loading/success/empty/error), primary slots have char limits, i18n variables match placeholder declarations, and experiment variants are non-empty strings.

**Upstream dependency:** none
**Output artifact:** `copy-structure-artifact.json`
**IR identifier:** `COPY_STRUCTURE:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "content_slots": [
    {
      "id": "hero-headline",
      "screen": "HomeScreen",
      "priority": "primary",
      "charLimit": 60,
      "content": "Welcome back, {{name}}",
      "placeholders": [
        { "key": "name", "type": "string", "example": "Alex" }
      ],
      "states": {
        "loading": { "content": "Loading…" },
        "success": { "inherit": true },
        "empty": { "content": "Get started" },
        "error": { "content": "Something went wrong" }
      }
    }
  ]
}
```

Required fields:
- `version` — declared string
- `content_slots` — non-empty array, each with `id`, `screen`, `priority`

---

## Gates

### UCS001 — spec-valid
Reads `copy-structure-spec.json`. Returns `skipped: true` if file not found. Required: `content_slots` (non-empty array), each slot: `id` (string), `screen` (string), `priority` (string).

Valid priorities: `primary`, `secondary`, `tertiary`.

BAD:
```json
{ "content_slots": [{ "id": "hero", "screen": "Home" }] }
// missing priority
```
GOOD:
```json
{ "content_slots": [{ "id": "hero", "screen": "Home", "priority": "primary" }] }
```

### UCS002 — unique-slot-ids
Every slot `id` must be unique within the spec. Duplicate ids cause cross-reference conflicts.

BAD:
```json
{ "content_slots": [{ "id": "cta" }, { "id": "cta" }] }
```
GOOD: All slot ids are unique strings.

### UCS003 — typed-placeholders
Every slot with a `placeholders` array must have each placeholder with: `key` (string), `type` (one of `string`, `number`, `date`, `currency`, `count`), `example` (non-empty value). Placeholders without type are unvalidatable.

BAD:
```json
{ "placeholders": [{ "key": "count" }] }
// missing type and example
```
GOOD:
```json
{ "placeholders": [{ "key": "count", "type": "number", "example": 42 }] }
```

### UCS004 — state-coverage
Every slot must declare all four states: `loading`, `success`, `empty`, `error`. Each state must have either `content` (string) or `inherit: true`. Empty string `""` is a violation.

BAD:
```json
{ "states": { "loading": { "content": "…" }, "success": { "inherit": true } } }
// missing empty and error
```
GOOD:
```json
{
  "states": {
    "loading": { "content": "Loading…" },
    "success": { "inherit": true },
    "empty": { "content": "No items found" },
    "error": { "content": "Failed to load" }
  }
}
```

### UCS005 — primary-char-limit
Slots with `priority: "primary"` must declare `charLimit` as a positive integer (> 0). Primary content slots drive layout and must have an enforced character limit to prevent overflow.

BAD:
```json
{ "priority": "primary" }
// missing charLimit
```
BAD: `"charLimit": 0` — zero is not a valid limit.
GOOD:
```json
{ "priority": "primary", "charLimit": 60 }
```

### UCS006 — i18n-variable-parity
Every `{{key}}` found in slot `content` must match a declared placeholder key. Undeclared template variables will break at runtime.

BAD:
```json
{ "content": "Hello {{name}}", "placeholders": [] }
// {{name}} not declared
```
GOOD:
```json
{
  "content": "Hello {{name}}",
  "placeholders": [{ "key": "name", "type": "string", "example": "Alex" }]
}
```

### UCS007 — experiment-variants
Slots with an `experimentVariant` field must have it as a non-empty string (or `null` to explicitly opt out). An empty string `""` means the variant is unnamed.

BAD:
```json
{ "experimentVariant": "" }
// empty string — unnamed variant
```
GOOD:
```json
{ "experimentVariant": "hero-v2" }
// or
{ "experimentVariant": null }
```

### UCS008 — contract-copy-structure
Final contract check: `version` declared, unique slot ids, each slot has `screen` reference.

---

## What This Compiler Never Forgives

- `copy-structure-spec.json` missing (UCS001 skips — not hard-fail)
- `content_slots` array missing or empty (UCS001)
- Any slot missing `id`, `screen`, or `priority` (UCS001)
- Duplicate slot ids (UCS002)
- Placeholder missing `key`, `type`, or `example` (UCS003)
- Invalid placeholder `type` (not string/number/date/currency/count) (UCS003)
- Any of the four states (loading/success/empty/error) missing (UCS004)
- State with neither `content` nor `inherit: true` (UCS004)
- `priority: "primary"` slot without `charLimit > 0` (UCS005)
- `{{key}}` in content not matching a declared placeholder (UCS006)
- `experimentVariant: ""` (empty string) (UCS007)
- `version` missing (UCS008)
