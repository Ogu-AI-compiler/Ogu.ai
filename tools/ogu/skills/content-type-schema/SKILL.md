---
name: content-type-schema
description: Compiler skill for the content-type-schema compiler. Activates when producing content-type-schema-artifact.json. Gates: CTS001–CTS007 + no-todos. Hard-fails when spec missing.
---

# content-type-schema — Compiler Skill

## What This Compiler Does

Compiles CMS content type schemas — validates spec structure (types array with IDs, display names, and fields), enforces globally unique type IDs, requires at least one required field per type, enforces unique constraints on slug fields, validates reference field integrity (no broken references, no circular dependencies), requires alt text policy declarations on image fields, and enforces camelCase field naming conventions.

**Upstream dependency:** none
**Output artifact:** `content-type-schema-artifact.json`
**IR identifier:** `CONTENT_TYPE_SCHEMA:{project}`

---

## Spec Shape

**`content-type-schema.spec.json`**:
```json
{
  "types": [
    {
      "id": "blogPost",
      "displayName": "Blog Post",
      "fields": [
        { "name": "title",       "type": "text",      "required": true  },
        { "name": "slug",        "type": "slug",       "required": true,  "unique": true },
        { "name": "heroImage",   "type": "image",      "required": false, "altRequired": true },
        { "name": "author",      "type": "reference",  "required": true,  "referenceTo": "author" },
        { "name": "publishedAt", "type": "datetime",   "required": false }
      ]
    },
    {
      "id": "author",
      "displayName": "Author",
      "fields": [
        { "name": "name",   "type": "text", "required": true },
        { "name": "bio",    "type": "text", "required": false },
        { "name": "avatar", "type": "image", "required": false, "altRequired": true }
      ]
    }
  ]
}
```

Required fields:
- `types` — non-empty array of content types
- Each type: `id` (string), `displayName` (string), `fields` (array)

---

## Gates

### CTS001 — spec-valid
Reads `content-type-schema.spec.json`. Hard-fails if missing. Required: `types` non-empty array, each type with `id`, `displayName`, and `fields` array.

BAD: spec missing or `types: []` or any type missing `id`, `displayName`, or `fields`.
GOOD: all types have `id`, `displayName`, and a `fields` array.

### CTS002 — unique-ids
All content type `id` values must be globally unique within the spec.

BAD:
```json
{ "types": [
  { "id": "article", "displayName": "Article", "fields": [...] },
  { "id": "article", "displayName": "News Article", "fields": [...] }
] }
// Duplicate id "article" — CMS cannot distinguish the two types
```
GOOD: Each type has a unique `id`.

### CTS003 — required-fields
Every content type must have at least one field with `required: true`. A type with no required fields allows empty content to be published.

BAD:
```json
{
  "id": "tag",
  "displayName": "Tag",
  "fields": [
    { "name": "label", "type": "text", "required": false }
  ]
}
// No required fields — an empty tag can be saved
```
GOOD:
```json
{
  "id": "tag",
  "displayName": "Tag",
  "fields": [
    { "name": "label", "type": "text", "required": true }
  ]
}
```

### CTS004 — slug-unique-constraint
Every field with `type: "slug"` must declare `unique: true`. Non-unique slugs break URL routing.

BAD:
```json
{ "name": "slug", "type": "slug", "required": true }
// unique:true missing — two posts could have the same slug
```
GOOD:
```json
{ "name": "slug", "type": "slug", "required": true, "unique": true }
```

### CTS005 — reference-integrity
Reference fields must point to existing type IDs in the spec. Circular references (A→B→A) are also blocked unless marked `bidirectional: true`.

BAD:
```json
{ "name": "category", "type": "reference", "referenceTo": "category-type" }
// "category-type" not defined in spec.types
```
BAD:
```json
// Type "post" references "author", "author" references "post" — circular
{ "name": "post", "type": "reference", "referenceTo": "author" }
```
GOOD:
```json
{ "name": "author", "type": "reference", "referenceTo": "author" }
// "author" is a defined type ID

// OR for bidirectional relationships:
{ "name": "relatedPost", "type": "reference", "referenceTo": "blogPost", "bidirectional": true }
```

### CTS006 — image-alt-declared
Every field with `type: "image"` must explicitly declare `altRequired` (or `altTextRequired`) as `true` or `false`. Absence means unknown accessibility policy.

BAD:
```json
{ "name": "thumbnail", "type": "image" }
// altRequired not declared — CMS doesn't know to ask for alt text
```
GOOD:
```json
{ "name": "thumbnail",        "type": "image", "altRequired": true }
// OR decorative:
{ "name": "decorativeBanner", "type": "image", "altRequired": false }
```

### CTS007 — field-naming-convention
All field `name` values must follow camelCase convention (`^[a-z][a-zA-Z0-9]*$`). Inconsistent naming breaks CMS field resolution and API serialization.

BAD:
```json
{ "name": "published_at", "type": "datetime" }
// snake_case — violates convention
{ "name": "HeroImage", "type": "image" }
// PascalCase — violates convention
```
GOOD:
```json
{ "name": "publishedAt", "type": "datetime" }
{ "name": "heroImage",   "type": "image" }
```

### CTS008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `content-type-schema.spec.json` missing (CTS001 hard-fails)
- `types` array empty or missing (CTS001)
- Any type missing `id`, `displayName`, or `fields` (CTS001)
- Duplicate type `id` values (CTS002)
- Content type with no `required: true` fields (CTS003)
- Slug field without `unique: true` (CTS004)
- Reference field pointing to undefined type ID (CTS005)
- Circular references without `bidirectional: true` (CTS005)
- Image field without `altRequired` declaration (CTS006)
- Field name not in camelCase (CTS007)
- TODO/FIXME/HACK/XXX anywhere (CTS008)
