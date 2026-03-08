---
name: graphql-resolver-module
description: Compiler skill for the graphql-resolver-module compiler. Activates when producing graphql-resolver-artifact.json. Gates: GR001–GR009. Upstream: optionally graphql-schema-artifact.json.
---

# graphql-resolver-module — Compiler Skill

## What This Compiler Does

Compiles GraphQL resolvers. Enforces that resolvers never call the database directly (service layer only), list resolvers are guarded against N+1 queries with DataLoader or batching, protected resolvers check authorization, and errors are thrown as `GraphQLError` (not raw `Error`).

**Upstream dependency:** optionally `graphql-schema-artifact.json`
**Output artifact:** `graphql-resolver-artifact.json`
**IR identifier:** `GRAPHQL_RESOLVER:{schemaName}`

---

## Spec Shape

```json
{
  "schemaName": "UserSchema",
  "resolvers": [
    {
      "type": "Query",
      "field": "user",
      "auth": "authenticated"
    },
    {
      "type": "Query",
      "field": "users",
      "auth": "authenticated",
      "isList": true
    },
    {
      "type": "Mutation",
      "field": "createUser",
      "auth": "role:admin"
    },
    {
      "type": "Query",
      "field": "publicHealth",
      "auth": "public"
    }
  ],
  "schemaArtifact": "../graphql-schema/graphql-schema-artifact.json"
}
```

`schemaArtifact` is optional — a relative path to the compiled schema artifact.
`isList` is optional — marks resolvers that return lists (relevant for N+1 check).
`auth` is required for each resolver: `"public"` | `"authenticated"` | `"role:X"`.

---

## Gates

### GR001 — spec-valid
Reads `graphql-resolver-spec.json`. Fails if missing or invalid JSON.

Required fields: `schemaName` (string), `resolvers` (non-empty array).

Each resolver entry must have: `type` (e.g. `"Query"`, `"Mutation"`, `"User"`), `field` (string), `auth` (string).

BAD: Resolver missing `auth` — authorization level is required for every resolver. `"resolvers": []` — must have at least one.
GOOD: Every resolver has `type`, `field`, and `auth`.

### GR002 — cross-schema
Skips (passes) if `schemaArtifact` is not set in the spec.

When declared: the artifact file must exist and be valid JSON. `artifact.schemaName` must equal `spec.schemaName`.

BAD: Spec declares `"schemaName": "UserSchema"` but artifact has `"schemaName": "UserSchemaV2"` — mismatch.
GOOD: Compile `graphql-schema-module` first; reference its artifact in `schemaArtifact`.

### GR003 — no-direct-db
Checks resolver files (files with `resolver` in the name; falls back to all source files if none).

Blocked patterns — direct ORM calls in resolvers:
- `prisma.*.findMany(` / `prisma.*.findOne(` / `prisma.*.create(` / etc.
- `db.*.*(` / `knex(` / `drizzle.*.(` / `typeorm.*.(` — any direct DB/ORM call

**Escape hatch:** add `// @direct-db-ok` on the same line.

Resolvers must call the service layer or context data sources, not query the DB directly.

BAD: `const user = await prisma.user.findUnique({ where: { id } });` in a resolver.
GOOD: `const user = await context.services.user.getUser(id);` or `context.loaders.user.load(id)`.

### GR004 — n-plus-one-guarded
Skips if no resolvers have `isList: true` AND all resolvers are Mutations (i.e., no list-returning resolvers declared).

Otherwise, at least one DataLoader or batch loading pattern must appear in the source:
- `DataLoader` / `dataloader`
- `context.loaders.*`
- `context.dataSources.*`
- `.load(` / `.loadMany(`
- `batchLoad` / `batchFn` / `batchFunction`

BAD: `users` query resolver calls `context.services.user.getUser(id)` in a loop — each item triggers a separate DB query.
GOOD:
```ts
users: async (parent, args, context) => {
  const ids = await context.services.user.listIds();
  return context.loaders.user.loadMany(ids); // batched
}
```

### GR005 — authorization-checked
Skips if all resolvers have `auth: "public"`.

When protected resolvers exist (`auth` ≠ `"public"`), at least one authorization pattern must appear in the source:
- `context.user` / `context.auth` / `context.currentUser` / `context.viewer`
- `requireAuth(` / `requireAuthorization(` / `isAuthenticated(` / `isAuthorized(`
- `GraphQLShield` / `shield(`
- `@auth(` / `@hasRole` / `@requiresAuth`
- `throwIfNotAuthenticated(` / `assertAuthenticated(` / `checkAuth(`
- `if (!context.user)`

BAD: Resolver has `auth: "authenticated"` but code never checks `context.user`.
GOOD:
```ts
user: async (parent, { id }, context) => {
  if (!context.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
  return context.services.user.getUser(id);
}
```

### GR006 — errors-mapped-to-graphql
Only checks files that are resolver files (filename or content contains `resolver`, `Resolver`, `Query`, `Mutation`, or `Subscription`).

Fails when: `throw new Error(...)` appears in a resolver file AND no `GraphQLError` / `ApolloError` pattern is found anywhere in that file.

If `GraphQLError` is present anywhere in the file, raw `Error` throws are tolerated (the assumption is some paths use GraphQLError correctly).

BAD: `throw new Error("User not found")` in resolver — exposes stack trace, no error code.
GOOD: `throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } })`

### GR007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### GR008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### GR009 — contract-graphql-resolver
Reads `graphql-resolver-artifact.json` (compiler-generated). Required fields: `ir_id`, `schemaName`, `resolverCount`, `attestation`.

- `ir_id` must start with `GRAPHQL_RESOLVER:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `graphql-resolver-spec.json` missing (GR001 hard-fails)
- Any resolver missing `auth` declaration in spec (GR001)
- Direct ORM/DB calls in resolvers — `prisma.*`, `db.*` — without `// @direct-db-ok` (GR003)
- List resolvers with no DataLoader or `context.loaders.*` usage (GR004)
- Protected resolvers with no authorization check pattern in code (GR005)
- `throw new Error(...)` in resolver files with no `GraphQLError` at all (GR006)
- No test files (GR008 hard-fails)
