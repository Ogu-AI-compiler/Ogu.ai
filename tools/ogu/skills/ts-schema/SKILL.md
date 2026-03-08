---
name: ts-schema
description: Compiler skill for the ts-schema compiler. Activates when producing schema-artifact.json. Gates: spec-valid, zod-valid, no-any, types-exported, no-todos, exhaustive-unions, refinements-documented, field-coverage, openapi-compatible, no-circular, contract-schema. No upstream dependency.
---

# ts-schema — Compiler Skill

## What This Compiler Does

Compiles a Zod schema as the shared contract between UI and API. Enforces type safety, OpenAPI compatibility, and structural contract compliance. Produces `schema.ts`, `types.ts`, `openapi-schema.json`, and `schema-artifact.json`.

**Upstream dependency:** none
**Output artifact:** `schema-artifact.json`
**IR identifiers:** `SCHEMA:{EntityName}`, `SCHEMA:{EntityName}Input`, `SCHEMA:{EntityName}Partial`, `SCHEMA:{EntityName}List`

---

## Spec Shape

```json
{
  "entity": "User",
  "fields": [
    { "name": "id",        "type": "uuid",    "required": true },
    { "name": "email",     "type": "email",   "required": true },
    { "name": "name",      "type": "string",  "required": true },
    { "name": "role",      "type": "enum",    "values": ["admin", "member"] },
    { "name": "createdAt", "type": "date",    "required": true }
  ],
  "relationships": [
    { "entity": "Organization", "type": "belongsTo" }
  ]
}
```

`entity` must be PascalCase (`^[A-Z][a-zA-Z0-9]+$`).

Each field `name` must be camelCase (`^[a-z][a-zA-Z0-9_]*$`) and have a `type`.

`relationships` is required but can be empty array `[]`.

---

## Output Files

| File | Purpose |
|---|---|
| `schema.ts` | Zod schema definitions with all constraints |
| `types.ts` | TypeScript type exports via `z.infer<>` |
| `openapi-schema.json` | JSON Schema / OpenAPI 3.x schema document |
| `schema-artifact.json` | Compiled artifact with attestation |

---

## Gates

### spec-valid (SC001)
Reads `schema-spec.json`. Fails if missing or invalid JSON.

Required: `entity` (PascalCase), `fields` (non-empty array), `relationships` (array — can be empty).

Each field must have camelCase `name` and `type`.

BAD: `"entity": "user"` — lowercase. `"entity": "user-profile"` — hyphen. Field missing `type`.
GOOD:
```json
{ "entity": "UserProfile", "fields": [{ "name": "displayName", "type": "string" }], "relationships": [] }
```

### zod-valid (SC002)
Reads `schema.ts`. Fails if missing.

Requires:
- Import of `z` from `'zod'` (any of: `import { z }`, `import * as z`, `require('zod')`)
- At least one `export const *Schema =` declaration
- Balanced braces (difference ≤2)
- Balanced parentheses (difference ≤2)
- `z.` prefix actually used (not just imported)

BAD: `schema.ts` uses `yup` instead of `z`. No exported constants.
GOOD:
```ts
import { z } from 'zod';
export const UserSchema = z.object({ ... });
```

### no-any (SC003)
Scans `schema.ts` and `types.ts` (if present).

**Hard blocked** (no exceptions):
- `: any` — TypeScript any annotation
- `as any` — type cast to any
- `z.any()` — Zod any schema

**Conditional** (allowed only with `// justification: <reason>` on the preceding line):
- `z.unknown()`
- `z.record(z.any())`
- `z.array(z.any())`

BAD:
```ts
metadata: z.any() // blocked
```
GOOD:
```ts
// justification: metadata is truly opaque — consumers must validate before use
metadata: z.unknown()
```

### types-exported (SC004)
For every `export const FooSchema = z...` in `schema.ts`, a corresponding type export must exist in `schema.ts` or `types.ts`:

```ts
export type Foo = z.infer<typeof FooSchema>;
```

The naming is derived by stripping `Schema` suffix: `UserSchema` → `User` type.

BAD:
```ts
export const UserSchema = z.object({ ... }); // no type export
```
GOOD:
```ts
export const UserSchema = z.object({ ... });
export type User = z.infer<typeof UserSchema>;
```

### no-todos (SC005)
Scans schema and types files. Blocked: `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`.

### exhaustive-unions (SC006)
`z.union([z.object(...), z.object(...)])` — union of objects — is blocked. Use `z.discriminatedUnion()` instead for discriminated object variants.

Also: every `z.discriminatedUnion(` call must have a discriminator field name string as the first argument.

BAD:
```ts
const ShapeSchema = z.union([
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('square'), side: z.number() }),
]);
```
GOOD:
```ts
const ShapeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('square'), side: z.number() }),
]);
```

### refinements-documented (SC007)
Every `.refine()` or `.superRefine()` call in `schema.ts` must have a non-empty message argument.

BAD:
```ts
z.string().refine(s => s.length > 0)          // no message
z.string().refine(s => isEmail(s), "")         // empty message
```
GOOD:
```ts
z.string().refine(s => isValidSlug(s), "Must be a URL-safe slug (lowercase, hyphens only)")
```

### field-coverage (SC008)
Every field name in `spec.fields[]` must appear as `fieldName:` inside the primary `EntitySchema` z.object block in `schema.ts`.

If the primary `EntitySchema` definition is not found, the gate checks the whole file.

BAD: `spec.fields` declares `["id", "email", "role"]` but `UserSchema` only has `id` and `email`.
GOOD: All spec fields implemented in the Zod object.

### openapi-compatible (SC010)
Checks `openapi-schema.json`:
- Must be valid JSON
- Must have `openapi` version field or `$schema` (JSON Schema)
- Must have `components.schemas`, `definitions`, or `properties`

Also checks `schema.ts` for `.transform(val => ...)` and `.pipe(` patterns. These may break OpenAPI generation. If found, the surrounding context (2 lines before, 3 lines after) must mention `openapi`, `serializ`, or `json schema`.

BAD: `openapi-schema.json` missing. Schema has `.transform()` without OpenAPI impact comment.
GOOD:
```ts
// openapi: output is string ISO date — no serialization issue
dateField: z.string().datetime().transform(s => new Date(s))
```

### no-circular (SC011)
Builds a reference graph of all `*Schema` declarations and runs DFS cycle detection.

BAD: `UserSchema` references `PostSchema` which references `UserSchema`.
GOOD: Use `z.lazy(() => UserSchema)` to break circular references.

### contract-schema
Validates structural contract rules:

| Rule | Check |
|---|---|
| pascal-case-schemas | Every exported Zod constant must end with `Schema` and start with uppercase |
| no-z-object-direct-export | `export default z.object(...)` blocked — assign to named const first |
| id-field-type | `id: z.string()` blocked — must be `z.string().uuid()` or `z.string().cuid()` |
| date-fields | `createdAt`/`updatedAt`/`deletedAt`/`publishedAt` must use `.datetime()` or `z.date()` |
| no-nested-any | `z.record(z.any())` requires `// justification:` comment on preceding line |

BAD:
```ts
export const userSchema = z.object({ id: z.string(), createdAt: z.string() });
// ^ lowercase name, id not uuid, createdAt not datetime
```
GOOD:
```ts
export const UserSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});
```

---

## What This Compiler Never Forgives

- `schema-spec.json` missing (spec-valid hard-fails)
- `entity` not PascalCase (spec-valid)
- Field `name` not camelCase (spec-valid)
- `schema.ts` missing or not importing from `'zod'` (zod-valid hard-fails)
- No exported `*Schema` const in `schema.ts` (zod-valid)
- Unbalanced braces or parens in `schema.ts` (zod-valid)
- `: any`, `as any`, or `z.any()` anywhere in schema files (no-any)
- `z.unknown()`, `z.record(z.any())`, or `z.array(z.any())` without `// justification:` comment (no-any)
- `FooSchema` exported without corresponding `export type Foo = z.infer<typeof FooSchema>` (types-exported)
- `z.union([z.object(...), z.object(...)])` — must use `z.discriminatedUnion()` (exhaustive-unions)
- `.refine()` or `.superRefine()` without non-empty message (refinements-documented)
- Field in `spec.fields` missing from `EntitySchema` z.object definition (field-coverage)
- `openapi-schema.json` missing or invalid (openapi-compatible)
- `.transform()` in schema without OpenAPI serialization comment (openapi-compatible)
- Circular schema reference (A → B → A) (no-circular)
- Schema constant not ending with `Schema` or not starting with uppercase (contract-schema)
- `id` field using plain `z.string()` without `.uuid()` or `.cuid()` (contract-schema)
- Timestamp fields (`createdAt`, `updatedAt`) using plain `z.string()` without `.datetime()` (contract-schema)
