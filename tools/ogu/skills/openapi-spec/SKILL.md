---
name: openapi-spec
description: Compiler skill for the openapi-spec aggregator compiler. Activates when producing openapi-artifact.json. Gates: OS001–OS009. Upstream: route-artifact.json files from compiled api-route modules.
---

# openapi-spec — Compiler Skill

## What This Compiler Does

Aggregator compiler: collects all `route-artifact.json` files in declared scan paths, assembles and validates a complete OpenAPI 3.1 document. Enforces fragment validity, no duplicate operationIds, no dangling `$ref` targets, all security schemes defined, and structural contract compliance (contact info, error codes, camelCase operationIds).

**Upstream dependency:** `route-artifact.json` files from `api-route` compiler(s)
**Output artifact:** `openapi-artifact.json`
**IR identifier:** `OPENAPI:{title}:{version}`
**Assembled document:** `openapi.json` (written during assembly phase)

---

## Spec Shape

```json
{
  "title": "User API",
  "version": "1.0.0",
  "description": "API for user management",
  "servers": [
    { "url": "https://api.example.com", "description": "Production" }
  ],
  "scanPaths": ["../users", "../auth", "../admin"],
  "contact": {
    "email": "api-support@example.com"
  },
  "auth": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  }
}
```

`scanPaths` is required — relative paths scanned recursively (depth 3) for `route-artifact.json` files.

---

## Gates

### OS001 — spec-valid
Reads `openapi-spec.json`. Fails if missing or invalid JSON.

Required fields: `title` (string), `version` (string), `servers` (non-empty array), `scanPaths` (non-empty array).

BAD: Missing `scanPaths` — the compiler won't know where to find route artifacts. `"servers": []` — must have at least one server.
GOOD: All four required fields present.

### OS002 — routes-found
Scans each path in `spec.scanPaths` recursively (depth 3, skipping `.`-prefixed and `node_modules` dirs) for `route-artifact.json` files.

Fails if no route artifacts are found at all.

BAD: Routes haven't been compiled yet — no `route-artifact.json` files exist.
FIX: Compile all `api-route` modules first: `ogu compiler api-route <slug>` for each route.

### OS003 — fragments-valid
For each `route-artifact.json` found, checks the sibling `openapi.json` in the same directory.

Fails if:
- `openapi.json` is missing from the route directory
- `openapi.json` can't parse as JSON
- A route operation has no `operationId`
- A route operation has no `2xx` response code

Accepts two fragment formats:
1. `{ paths: { "/users": { get: { ... } } } }` — paths wrapper format
2. `{ get: { ... } }` — direct path-item format (no paths wrapper)

BAD: Route `openapi.json` has `responses: { "500": ... }` only — no `2xx`.
GOOD: Each operation has `operationId` and at least one `200`/`201`/`204` response.

### OS004 — no-conflicts
Reads all route artifacts and their `openapi.json` fragments.

Two types of conflicts blocked:
1. **Duplicate method+path**: two routes with identical `"POST /api/users"` — which one wins?
2. **Duplicate operationId**: two operations share the same `operationId` string

BAD: Two route modules both declare `POST /api/users` — conflicts.
BAD: Two operations both use `operationId: "createUser"`.
GOOD: Every route has a unique method+path combination and unique operationId.

### OS005 — openapi-valid
Reads the assembled `openapi.json` (written during assembly phase).

Checks:
- `openapi` field starts with `"3."` — version 3.x required
- `info.title` present
- `info.version` present
- `paths` is non-empty
- `servers` is non-empty with at least one entry
- No dangling `$ref` values (all `#/...` refs must resolve within the document)

Also reports as OS007 if schema refs are dangling.

BAD: Assembled document missing `info.contact` or dangling `$ref: "#/components/schemas/UserProfile"` when `UserProfile` isn't in components.
GOOD: All `$ref` values point to defined components.

### OS006 — all-routes-covered
Reads `openapi.json`. For each `route-artifact.json` in scope, checks that `artifact.path` appears in `doc.paths`.

Normalizes Express-style params: `:id` → `{id}` for comparison.

BAD: `route-artifact.json` declares `GET /users/:id` but the assembled spec has no `/users/{id}` path.
GOOD: Every compiled route appears as a path entry in the assembled document.

### OS007 — schemas-referenced
Explicit check focused on `components/schemas` refs used in `doc.paths`.

All `$ref: "#/components/schemas/Foo"` values in the paths section must correspond to a key in `doc.components.schemas`.

BAD: `$ref: "#/components/schemas/CreateUserInput"` in `requestBody` but `CreateUserInput` not in `components.schemas`.
GOOD: All referenced schemas are defined in `components.schemas`.

### OS008 — auth-schemes
Scans all `security` arrays throughout the assembled `openapi.json` (global and per-operation) and collects referenced scheme names.

Every scheme name used must appear in `components.securitySchemes`.

BAD: Operation has `security: [{ "bearerAuth": [] }]` but `bearerAuth` not in `components.securitySchemes`.
GOOD:
```json
"components": {
  "securitySchemes": {
    "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
  }
}
```

### OS009 — contract-openapi
Validates the assembled `openapi.json` against structural contract rules:

| Rule | Check |
|---|---|
| info-complete | `info.description` and `info.contact.email` must be present |
| servers-defined | `servers[]` must have at least one entry with a `url` |
| errors-documented | POST/PUT/PATCH operations must document `400`; secured operations must document `401`; all operations must document `500` or `5XX` |
| no-empty-paths | Every path entry must have at least one operation |
| operation-ids | All `operationId` values must be camelCase (`^[a-z][a-zA-Z0-9]*$`) |
| response-schemas | 2xx responses (except 204) must have `content` with a schema |

BAD: `POST /users` missing `400` response. `operationId: "create_user"` — snake_case fails.
GOOD:
```json
"post": {
  "operationId": "createUser",
  "responses": {
    "201": { "content": { "application/json": { "schema": { "$ref": "#/components/schemas/User" } } } },
    "400": { "description": "Validation error" },
    "401": { "description": "Unauthorized" },
    "500": { "description": "Server error" }
  }
}
```

---

## What This Compiler Never Forgives

- `openapi-spec.json` missing (OS001 hard-fails)
- `scanPaths` missing or empty (OS001)
- No `route-artifact.json` files found — routes not compiled yet (OS002)
- Route `openapi.json` missing `operationId` or 2xx response (OS003)
- Duplicate `operationId` across routes (OS004)
- Assembled `openapi.json` missing or version not 3.x (OS005)
- Route not present in assembled paths (OS006)
- `$ref: "#/components/schemas/Foo"` with Foo not defined (OS007)
- Security scheme used without definition in `components.securitySchemes` (OS008)
- Missing `info.description` or `info.contact.email` (OS009)
- POST/PUT/PATCH without `400` response documented (OS009)
- Secured operation without `401` documented (OS009)
- `operationId` not camelCase (OS009)
