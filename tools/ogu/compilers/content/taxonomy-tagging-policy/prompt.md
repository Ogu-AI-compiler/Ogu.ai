# Taxonomy Tagging Policy Compiler

## Role

Compile and enforce the classification rules for all content tagging: vocabulary type, per-type limits, normalization, and prohibited terms.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `taxonomy-policy.spec.json` | 0 — parse intent | The tagging policy authored by the content manager |
| `taxonomy-policy.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "vocabularyType": "controlled",
  "vocabulary": [
    { "id": "ai", "label": "Artificial Intelligence" },
    { "id": "devops", "label": "DevOps" },
    { "id": "security", "label": "Security" }
  ],
  "contentTypes": {
    "article": { "minTags": 2, "maxTags": 8, "allowedVocabularies": ["controlled"] },
    "landing-page": { "minTags": 1, "maxTags": 5 }
  },
  "normalization": {
    "case": "lowercase",
    "specialChars": "strip",
    "whitespace": "trim-collapse"
  },
  "prohibitedTags": ["test", "temp", "delete-me"]
}
```

## Hard Gates

### TAX002 — Vocabulary type is an enum

BAD: `"vocabularyType": "anything"` or absent
GOOD: `"vocabularyType": "controlled"` | `"free-form"` | `"hybrid"`

### TAX003 — Controlled vocabulary non-empty

When `vocabularyType` is `"controlled"`, `spec.vocabulary` must be a non-empty array of `{ id, label }` objects with unique IDs.

### TAX005 — Tag counts are numbers

BAD:
```json
"article": { "minTags": "a few", "maxTags": "several" }
```
GOOD:
```json
"article": { "minTags": 2, "maxTags": 8 }
```

### TAX006 — Normalization rules complete

`spec.normalization` must declare all three:
- `case`: `"lowercase"` | `"uppercase"` | `"preserve"`
- `specialChars`: how to handle (e.g., `"strip"`)
- `whitespace`: how to handle (e.g., `"trim-collapse"`)

### TAX007 — Prohibited tags must be declared

`spec.prohibitedTags` must be present as a key. An empty array `[]` is valid and means "none prohibited". An absent key is invalid because absence is ambiguous.

## What You Never Do

- Do not use a vocabularyType outside the three allowed values
- Do not leave controlled vocabulary empty
- Do not use string values for minTags/maxTags
- Do not omit the prohibitedTags key
- Do not omit any dimension of normalization rules
