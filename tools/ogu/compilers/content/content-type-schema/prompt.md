# Content Type Schema Compiler

## Role

Compile and enforce the structural contract for all CMS content type definitions.
Every field, relationship, and naming rule is verified before any content can be authored against the schema.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `content-type-schema.spec.json` | 0 — parse intent | The content type definitions authored by the content manager |
| `content-type-schema.json` | 5 — attest | Written by the compiler on full pass. The verified schema artifact. |

## Spec Shape

```json
{
  "types": [
    {
      "id": "article",
      "displayName": "Article",
      "fields": [
        { "name": "title",     "type": "string",    "required": true,  "maxLength": 100 },
        { "name": "slug",      "type": "slug",      "required": true,  "unique": true },
        { "name": "body",      "type": "richtext",  "required": true,  "allowedBlocks": ["paragraph","heading","image","quote"] },
        { "name": "author",    "type": "reference", "required": true,  "referenceTo": "author" },
        { "name": "heroImage", "type": "image",     "required": true,  "altRequired": true },
        { "name": "seoTitle",  "type": "string",    "required": false, "maxLength": 60 }
      ]
    },
    {
      "id": "author",
      "displayName": "Author",
      "fields": [
        { "name": "displayName", "type": "string", "required": true },
        { "name": "slug",        "type": "slug",   "required": true, "unique": true },
        { "name": "headshot",    "type": "image",  "required": true, "altRequired": true },
        { "name": "bio",         "type": "text",   "required": true, "maxLength": 160 }
      ]
    }
  ]
}
```

## Hard Gates

### CTS004 — Slug unique constraint

Every `slug` field must declare `unique: true`. A slug without uniqueness constraint allows duplicate URLs.

BAD:
```json
{ "name": "slug", "type": "slug", "required": true }
```

GOOD:
```json
{ "name": "slug", "type": "slug", "required": true, "unique": true }
```

### CTS005 — Reference integrity

Every `reference` field must declare `referenceTo` pointing to a type ID that exists in the same schema.

BAD:
```json
{ "name": "category", "type": "reference", "referenceTo": "productCategory" }
```
(Fails if `productCategory` is not in `spec.types`)

GOOD:
```json
{ "name": "category", "type": "reference", "referenceTo": "category" }
```
(Where `"category"` is defined as another type in the same schema)

### CTS006 — Image alt text requirement

Every `image` field must explicitly declare `altRequired: true` or `altRequired: false`.

BAD:
```json
{ "name": "heroImage", "type": "image", "required": true }
```

GOOD:
```json
{ "name": "heroImage", "type": "image", "required": true, "altRequired": true }
```

### CTS007 — camelCase field names

All field `name` values must be camelCase (`[a-z][a-zA-Z0-9]*`).

BAD: `hero_image`, `Hero-Image`, `HERO`, `_internal`
GOOD: `heroImage`, `seoTitle`, `publishedAt`, `authorId`

## Contract

A fully compliant spec:
- Has a non-empty `types` array
- Every type has a unique `id` and a `displayName`
- Every type has at least one `required: true` field
- Every `slug` field has `unique: true`
- Every `reference` field has a `referenceTo` pointing to an existing type
- No circular references (unless `bidirectional: true`)
- Every `image` field has `altRequired` declared
- All field names are camelCase

## What You Never Do

- Do not create a type without at least one required field
- Do not use `type: "slug"` without `unique: true`
- Do not reference a type ID that doesn't exist in the schema
- Do not use snake_case, PascalCase, or kebab-case field names
- Do not leave circular references without marking `bidirectional: true`
- Do not leave image fields without `altRequired` declaration
