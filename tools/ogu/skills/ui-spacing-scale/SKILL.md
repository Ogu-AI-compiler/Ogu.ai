---
name: ui-spacing-scale
description: Compiler skill for the ui-spacing-scale compiler. Activates when producing spacing-scale-artifact.json. Gates: USS001–USS007. No upstream dependency.
---

# ui-spacing-scale — Compiler Skill

## What This Compiler Does

Compiles the application's spacing scale — a systematic set of spacing values with semantic roles for layout categories. Enforces: all step values are multiples of the declared base unit, no duplicate pixel values, no step below 2px, semantic roles covering inset/stack/inline/gap categories, at least 4 steps with ids and values.

**Upstream dependency:** none
**Output artifact:** `spacing-scale-artifact.json`
**IR identifier:** `SPACING_SCALE`

---

## Spec Shape

```json
{
  "baseUnit": "4px",
  "steps": [
    { "id": "1",  "name": "xs",  "value": "4px",  "role": "inset-xs" },
    { "id": "2",  "name": "sm",  "value": "8px",  "role": "inset-sm" },
    { "id": "3",  "name": "md",  "value": "12px", "role": "inset-md" },
    { "id": "4",  "name": "base","value": "16px", "role": "inset-base" },
    { "id": "5",  "name": "lg",  "value": "20px" },
    { "id": "6",  "name": "xl",  "value": "24px", "role": "stack-sm" },
    { "id": "8",  "name": "2xl", "value": "32px", "role": "stack-md" },
    { "id": "10", "name": "3xl", "value": "40px", "role": "stack-lg" },
    { "id": "12", "name": "4xl", "value": "48px", "role": "gap-md" },
    { "id": "16", "name": "5xl", "value": "64px", "role": "gap-lg" }
  ],
  "semanticRoles": {
    "inline-sm": "{spacing.2}",
    "inline-md": "{spacing.4}",
    "inline-lg": "{spacing.6}"
  }
}
```

### Semantic Role Categories

Four required categories — at least one role per category must be declared:

| Category | Prefix | Purpose |
|---|---|---|
| `inset` | `inset-*` | Padding inside components |
| `stack` | `stack-*` | Vertical space between stacked elements |
| `inline` | `inline-*` | Horizontal space between inline elements |
| `gap` | `gap-*` | Grid/flex gap between items |

Roles can be declared either on individual steps (`role` field) or in `spec.semanticRoles` object, or both.

---

## Gates

### USS001 — spec-valid
Reads `spacing-scale-spec.json`. Required fields: `baseUnit`, `steps` (non-empty array).

BAD: Missing `baseUnit` or empty `steps` array.
GOOD:
```json
{ "baseUnit": "4px", "steps": [...] }
```

### USS002 — base-multiples
Every step with a parseable value (px, rem, or plain number) must be a multiple of the declared `baseUnit`.

Token references (non-parseable values) are skipped.

BAD:
```json
{ "baseUnit": "4px", "steps": [{ "id": "odd", "value": "7px" }] }
// 7px is not a multiple of 4px
```
GOOD:
```json
{ "baseUnit": "4px", "steps": [
  { "id": "1", "value": "4px" },
  { "id": "2", "value": "8px" },
  { "id": "3", "value": "12px" }
]}
```

### USS003 — semantic-roles
Semantic roles must be declared covering all 4 categories: `inset-*`, `stack-*`, `inline-*`, `gap-*`. At least one role starting with each prefix must exist.

Roles can appear in `spec.semanticRoles` (object), as `role` field on steps, or as `roles` array on steps.

BAD: Only `inset-*` and `stack-*` roles declared — missing `inline-*` and `gap-*`.
GOOD:
```json
{
  "steps": [
    { "id": "2", "value": "8px",  "role": "inset-sm" },
    { "id": "4", "value": "16px", "roles": ["inset-md", "inline-md"] }
  ],
  "semanticRoles": {
    "stack-sm": "{spacing.6}",
    "gap-md": "{spacing.12}"
  }
}
```

### USS004 — no-duplicates
No two steps may resolve to the same pixel value.

BAD:
```json
[
  { "id": "md",   "value": "16px" },
  { "id": "base", "value": "16px" }
]
// duplicate — 16px appears twice
```
GOOD: Every step has a unique pixel value.

### USS005 — min-spacing
No step may have a value below 2px.

BAD:
```json
{ "id": "hairline", "value": "1px" }
// below 2px minimum
```
GOOD: All step values ≥ 2px.

### USS006 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### USS007 — contract-spacing
Four contract rules:

| Rule | Requirement |
|---|---|
| `minimum-four-steps` | At least 4 steps declared |
| `steps-have-ids` | Every step has `id` or `name` |
| `steps-have-values` | Every step has `value` field |
| `base-unit-parseable` | `baseUnit` must be parseable as a numeric px value |

BAD: Only 3 steps, or steps without ids, or `baseUnit: "one grid unit"` (unparseable).
GOOD:
```json
{
  "baseUnit": "4px",
  "steps": [
    { "id": "1", "value": "4px" },
    { "id": "2", "value": "8px" },
    { "id": "4", "value": "16px" },
    { "id": "8", "value": "32px" }
  ]
}
```

---

## What This Compiler Never Forgives

- `spacing-scale-spec.json` missing (USS001 hard-fails)
- `baseUnit` missing (USS001)
- `steps` empty or missing (USS001)
- Step value not a multiple of baseUnit (USS002)
- No semantic roles for any category (USS003)
- Missing `inset-*`, `stack-*`, `inline-*`, or `gap-*` role category (USS003)
- Two steps resolving to the same pixel value (USS004)
- Any step below 2px (USS005)
- Fewer than 4 steps (USS007)
- Steps missing `id`/`name` or `value` field (USS007)
- `baseUnit` not parseable as a pixel value (USS007)
