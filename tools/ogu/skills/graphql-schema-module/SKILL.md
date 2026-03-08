---
name: graphql-schema-module
description: Compiler skill for the graphql-schema-module compiler. Activates when producing graphql-schema-artifact.json. Gates: GS001–GS008. No upstream dependency. Downstream: graphql-resolver-module (cross-schema gate).
---

# graphql-schema-module — Compiler Skill

## What This Compiler Does

Compiles a GraphQL SDL schema from domain entities. Enforces that the SDL file parses without errors, sensitive fields are not exposed, mutations return dedicated payload types (not root entities), and relay pagination is correctly implemented when declared.

**Upstream dependency:** none
**Output artifact:** `graphql-schema-artifact.json` (consumed by `graphql-resolver-module` cross-schema gate)
**IR identifier:** `GRAPHQL_SCHEMA:{schemaName}`
**SDL file:** referenced by `spec.sdlFile` — the actual `.graphql` file

---

## Spec Shape

```json
{
  "schemaName": "UserSchema",
  "entities": ["User", "Profile"],
  "sdlFile": "schema.graphql",
  "pagination": "relay"
}
```

`pagination` is optional — `"relay"` enables Relay connection spec check. Omit or use `"offset"` for offset-based pagination.

---

## Gates

### GS001 — spec-valid
Reads `graphql-schema-spec.json`. Fails if missing or invalid JSON.

Required fields: `schemaName` (string), `entities` (non-empty array), `sdlFile` (string — path to `.graphql` file).

Also checks that `spec.sdlFile` actually exists on disk.

BAD: `"entities": []` — must have at least one. `sdlFile` pointing to a non-existent file.
GOOD: All three required fields present; `sdlFile` exists at the declared path.

### GS002 — schema-parses
Reads `spec.sdlFile` and parses it using `graphql-js` via a temporary script.

Fallback structural checks if graphql-js not available:
- SDL must contain at least one `type X` definition
- SDL must have a `type Query` definition
- Braces must be balanced

BAD: `type User { id: ID, name: String` — unclosed brace fails parsing.
GOOD: Valid GraphQL SDL that `graphql.parse()` accepts without throwing.

### GS003 — no-unsafe-fields
Scans the SDL file for fields whose names match sensitive patterns:

Blocked field names: `password`, `passwordHash`, `password_hash`, `secret`, `apiKey`, `api_key`, `privateKey`, `private_key`, `internalToken`

A field is allowed if it (or the next line) has `@deprecated`, `@internal`, or `@skip`.

BAD: `passwordHash: String!` in a `User` type — internal implementation detail exposed in the API.
GOOD: Remove the field entirely, or mark it: `passwordHash: String @deprecated(reason: "Internal only")`.

### GS004 — mutations-return-payload
Only runs if a `type Mutation` block exists in the SDL.

For each mutation, checks the return type against `spec.entities[]`. If the return type is directly an entity name (e.g. `User`) and that name is in `spec.entities`, it fails — unless the return type ends with `Payload`, `Result`, or `Response`.

BAD: `createUser(input: CreateUserInput!): User!` — returns the root entity directly.
GOOD:
```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

type CreateUserPayload {
  user: User
  errors: [UserError!]
}
```

### GS005 — pagination-relay
Skips if `spec.pagination` is not `"relay"`.

When `"relay"` is declared, all five Relay connection spec elements must be present in the SDL:
1. `type PageInfo {`
2. `hasNextPage: Boolean!`
3. `hasPreviousPage: Boolean!`
4. `edges: [` — a connection type with an edges array
5. `node: SomeType` — an edge type with a node field

BAD: Spec has `"pagination": "relay"` but SDL only has `first: Int, offset: Int` pagination arguments.
GOOD:
```graphql
type UserConnection {
  edges: [UserEdge]
  pageInfo: PageInfo!
}
type UserEdge {
  node: User
  cursor: String!
}
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### GS006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files (not the `.graphql` SDL file itself). Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### GS007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### GS008 — contract-graphql-schema
Reads `graphql-schema-artifact.json` (compiler-generated). Required fields: `ir_id`, `schemaName`, `entities`, `sdlFile`, `attestation`.

- `ir_id` must start with `GRAPHQL_SCHEMA:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `graphql-schema-spec.json` missing (GS001 hard-fails)
- `sdlFile` path declared in spec but file does not exist (GS001)
- SDL with unbalanced braces or parse errors (GS002)
- `password`, `passwordHash`, `secret`, `apiKey`, `privateKey`, `internalToken` fields exposed without `@deprecated` (GS003)
- Mutation returning an entity from `spec.entities[]` directly instead of a payload type (GS004)
- `"pagination": "relay"` declared but PageInfo, edges, node, hasNextPage, hasPreviousPage missing (GS005)
- No test files (GS007 hard-fails)
