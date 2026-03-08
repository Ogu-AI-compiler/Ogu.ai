---
name: taxonomy-tagging-policy
description: Compiler skill for the taxonomy-tagging-policy compiler. Activates when producing taxonomy-artifact.json. Gates: TAX001–TAX007 + no-todos. Hard-fails when spec missing.
---

# taxonomy-tagging-policy — Compiler Skill

## What This Compiler Does

Compiles taxonomy and tagging policies — validates spec structure (vocabularyType and contentTypes), requires explicit vocabulary type declaration (controlled/free-form/hybrid), validates that controlled vocabularies have a non-empty tag list with unique IDs, requires per-content-type min/max tag count rules, validates numeric integrity of tag counts, requires normalization rules covering case, special characters, and whitespace, and requires an explicit prohibited tags declaration.

**Upstream dependency:** none
**Output artifact:** `taxonomy-artifact.json`
**IR identifier:** `TAXONOMY_POLICY:{project}`

---

## Spec Shape

**`taxonomy-policy.spec.json`**:
```json
{
  "vocabularyType": "controlled",
  "vocabulary": [
    { "id": "technology",  "label": "Technology" },
    { "id": "design",      "label": "Design" },
    { "id": "engineering", "label": "Engineering" }
  ],
  "contentTypes": {
    "blogPost": {
      "minTags": 1,
      "maxTags": 5,
      "allowedVocabularies": ["technology", "design", "engineering"]
    },
    "caseStudy": {
      "minTags": 2,
      "maxTags": 8
    }
  },
  "normalization": {
    "case":         "lowercase",
    "specialChars": "strip",
    "whitespace":   "trim-collapse"
  },
  "prohibitedTags": ["test", "temp", "delete-me"]
}
```

Required fields:
- `vocabularyType` — string
- `contentTypes` — object

---

## Gates

### TAX001 — spec-valid
Reads `taxonomy-policy.spec.json`. Hard-fails if missing. Required: `vocabularyType` string, `contentTypes` object.

BAD: spec missing or `vocabularyType` absent or `contentTypes` missing.
GOOD: both fields present with correct types.

### TAX002 — vocabulary-type-declared
`vocabularyType` must be one of: `"controlled"`, `"free-form"`, `"hybrid"`. Any other value is rejected.

BAD:
```json
{ "vocabularyType": "open" }
// "open" not in valid set
```
GOOD:
```json
{ "vocabularyType": "controlled" }
{ "vocabularyType": "free-form" }
{ "vocabularyType": "hybrid" }
```

### TAX003 — controlled-vocab-non-empty
When `vocabularyType: "controlled"`, the `vocabulary` array must be non-empty and each entry must have a unique `id` and a `label`. Skips for `free-form` and `hybrid` types.

BAD:
```json
{
  "vocabularyType": "controlled",
  "vocabulary": []
}
// Empty controlled vocabulary — no valid tags can be applied
```
BAD:
```json
{
  "vocabularyType": "controlled",
  "vocabulary": [
    { "id": "tech", "label": "Tech" },
    { "id": "tech", "label": "Technology" }
  ]
}
// Duplicate id "tech"
```
GOOD:
```json
{
  "vocabularyType": "controlled",
  "vocabulary": [
    { "id": "technology", "label": "Technology" },
    { "id": "design",     "label": "Design" }
  ]
}
```

### TAX004 — per-type-tag-rules
Every content type in `spec.contentTypes` must declare both `minTags` and `maxTags`. Missing rules mean the CMS applies no tag count constraints for that content type.

BAD:
```json
{
  "contentTypes": {
    "blogPost": { "minTags": 1 }
  }
}
// maxTags missing — no upper bound on tags
```
GOOD:
```json
{
  "contentTypes": {
    "blogPost": { "minTags": 1, "maxTags": 5 }
  }
}
```

### TAX005 — tag-counts-numeric
`minTags` and `maxTags` must be non-negative numbers and `minTags` must not exceed `maxTags`.

BAD:
```json
{ "minTags": "one", "maxTags": 5 }
// minTags is a string, not a number
{ "minTags": 6, "maxTags": 3 }
// min > max — impossible constraint
{ "minTags": -1, "maxTags": 5 }
// Negative min
```
GOOD:
```json
{ "minTags": 1, "maxTags": 5 }
{ "minTags": 0, "maxTags": 10 }
```

### TAX006 — normalization-rules
`spec.normalization` must be declared and cover all three dimensions: `case`, `specialChars`, and `whitespace`. Valid `case` values: `"lowercase"`, `"uppercase"`, `"preserve"`.

BAD:
```json
// normalization absent entirely
```
BAD:
```json
{
  "normalization": {
    "case": "lowercase"
  }
}
// Missing specialChars and whitespace
```
BAD:
```json
{
  "normalization": {
    "case": "title-case",
    "specialChars": "strip",
    "whitespace": "trim"
  }
}
// "title-case" not in valid case values
```
GOOD:
```json
{
  "normalization": {
    "case":         "lowercase",
    "specialChars": "strip",
    "whitespace":   "trim-collapse"
  }
}
```

### TAX007 — prohibited-tags-declared
`spec.prohibitedTags` must be explicitly declared as an array (may be empty). Absence means there is no explicit policy — the compiler cannot distinguish "no prohibited tags" from "nobody thought about it."

BAD:
```json
{
  "vocabularyType": "free-form",
  "contentTypes": { "blogPost": { "minTags": 0, "maxTags": 10 } }
}
// prohibitedTags not declared — policy unknown
```
GOOD:
```json
{ "prohibitedTags": [] }
// Empty array is valid — explicitly states no tags are prohibited

{ "prohibitedTags": ["test", "temp", "wip", "delete-me"] }
// Explicit prohibited list
```

### TAX008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `taxonomy-policy.spec.json` missing (TAX001 hard-fails)
- `vocabularyType` or `contentTypes` missing (TAX001)
- `vocabularyType` not one of: controlled, free-form, hybrid (TAX002)
- `vocabularyType: "controlled"` with empty or missing `vocabulary` array (TAX003)
- Controlled vocabulary entries without `id` or `label`, or with duplicate `id` (TAX003)
- Any content type in `contentTypes` missing `minTags` or `maxTags` (TAX004)
- `minTags` or `maxTags` not a number, or `minTags > maxTags`, or `minTags < 0` (TAX005)
- `normalization` object missing entirely (TAX006)
- `normalization` missing `case`, `specialChars`, or `whitespace` (TAX006)
- `normalization.case` not one of: lowercase, uppercase, preserve (TAX006)
- `prohibitedTags` not declared as an array (TAX007)
- TODO/FIXME/HACK/XXX anywhere (TAX008)
