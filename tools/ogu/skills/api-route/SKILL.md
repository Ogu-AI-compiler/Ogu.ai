---
name: api-route
description: Compiler skill for the api-route compiler. Activates when producing route-artifact.json. Gates: AR001–AR014. Upstream: optionally ts-schema, auth-middleware, db-migration.
---

# api-route — Compiler Skill

## What This Compiler Does

Compiles a single API route. Enforces that the route has a valid spec, typed input/output schemas, a handler that validates input before use, proper error codes, no raw SQL, complete OpenAPI documentation, passing tests with ≥80% coverage, and cross-compilation integrity with auth middleware and database migrations.

**Upstream dependency:** optionally `schema-artifact.json` (ts-schema), `auth-artifact.json` (auth-middleware), `migration-artifact.json` (db-migration)
**Output artifact:** `route-artifact.json`
**IR identifier:** `ROUTE:{METHOD} {path}`
**Files you create:** `route-spec.json`, `schema.ts`, `handler.ts`, `openapi.json`, test file(s)

---

## Files You Must Create

| File | Purpose |
|---|---|
| `route-spec.json` | Declares method, path, input/output shape, auth strategy |
| `schema.ts` | Exports `InputSchema` and `OutputSchema` |
| `handler.ts` | The route handler — must export `async function handle` |
| `openapi.json` | OpenAPI 3.x documentation for this route |
| `handler.test.ts` | (or `*.spec.ts`) — at least one test file must exist |

---

## Spec Shape

```json
{
  "method": "POST",
  "path": "/api/users",
  "input": {
    "email": "string",
    "name": "string"
  },
  "output": {
    "id": "string",
    "email": "string",
    "name": "string",
    "createdAt": "string"
  },
  "auth": "bearer"
}
```

Valid `auth` values: `none` | `bearer` | `session` | `api-key` | `required`

---

## Gates

### AR001 — spec-valid
Reads `route-spec.json`. Skips (pass) if file absent.

Required fields: `method` (GET/POST/PUT/PATCH/DELETE), `path` (must start with `/`), `input` (any object), `output` (any object), `auth` (one of the five valid values).

BAD: `"method": "get"` — must be uppercase. `"path": "api/users"` — must start with `/`. `"auth": "jwt"` — not in enum (use `bearer`).
GOOD: `"method": "POST"`, `"path": "/api/users"`, `"auth": "bearer"`.

### AR002 — schema-valid
Reads `schema.ts`. Fails if the file is missing (unlike AR001, this is not optional).

`schema.ts` must export both `InputSchema` and `OutputSchema` — as a `const`, `type`, or `interface`. Either named export or re-export via `export { InputSchema }` is accepted.

Unbalanced braces (absolute difference > 2) also fail.

BAD: `schema.ts` absent, or only `InputSchema` exported, or `export const inputSchema` (wrong case).
GOOD:
```ts
export const InputSchema = z.object({ email: z.string(), name: z.string() });
export const OutputSchema = z.object({ id: z.string(), email: z.string() });
```

### AR003 — auth-present
Skips (passes) if `spec.auth === "none"`. For all other auth values, scans every non-test `.ts` file in the route directory.

Auth check must appear **before** the first line of business logic. Business logic indicators: `await db.find*`, `await db.create*`, `await db.update*`, `await db.delete*`, `await db.query*`, `return data`, `return result`.

Auth patterns recognized: `requireAuth`, `authenticate`, `verifyToken`, `req.user`, `req.auth`, `getSession`, `Authorization`, `Bearer`, `passport.authenticate`, `JwtAuthGuard`, `useGuards`.

Evaluation is **per-file**: a file where business logic appears before any auth check fails even if another file passes.

BAD:
```ts
const user = await prisma.user.findFirst({ where: { id } }); // business logic first
const auth = requireAuth(req);                                 // auth too late
```
GOOD:
```ts
const auth = requireAuth(req);                                 // auth first
if (!auth) return res.status(401).json({ error: "Unauthorized" });
const user = await prisma.user.findFirst({ where: { id } });
```

### AR004 — error-codes
Reads `handler.ts`. The following are required based on route characteristics:

| Requirement | Applies to |
|---|---|
| HTTP 400 (validation error) | Every handler |
| HTTP 401 (unauthorized) | Protected routes (`auth !== "none"`) |
| try/catch OR HTTP 500 | Every handler |
| Error envelope `{ error: ... }` | Every handler |

BAD: Handler returns `{ message: "Bad input" }` instead of `{ error: "Bad input" }`. Handler has no `try/catch` and no `res.status(500)`. Protected route missing 401 response.

GOOD:
```ts
export async function handle(req, res) {
  try {
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const auth = requireAuth(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    const result = await prisma.user.create({ data: parsed.data });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

### AR005 — no-raw-sql
Scans all non-test `.ts`/`.js` files recursively in the route directory.

Blocked patterns:
- Template literals starting with `SELECT`, `INSERT INTO`, `UPDATE ... SET`, `DELETE FROM`
- `query("SELECT ...")`, `query(\`INSERT ...\`)`
- `$queryRaw\``, `$executeRaw\``, `knex.raw(`, `db.query(`, `.raw(`

Escape hatch: add `// @raw-sql-ok: <reason>` in the 3 lines preceding the raw SQL line.

BAD: `const rows = await db.query(\`SELECT * FROM users WHERE id = ${id}\`)` — interpolated SQL.
GOOD: `const rows = await prisma.user.findMany({ where: { id } })` — ORM method.
ALLOWED:
```ts
// @raw-sql-ok: full-text search not supported by ORM
const rows = await db.query(`SELECT * FROM posts WHERE to_tsvector(body) @@ plainto_tsquery($1)`, [q]);
```

### AR006 — no-todos
Checks `handler.ts` and `schema.ts`.

Blocked markers: `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`, `XXX` (case-insensitive).

BAD: `// TODO: add auth check`, `const x = "PLACEHOLDER"`.
GOOD: remove all markers before compiling.

### AR007 — openapi-shape
Reads `openapi.json`. Fails if the file is missing.

Requirements:
- Valid JSON
- Must have a `paths` object with at least one path defined
- Each path must have at least one valid HTTP method (`get`, `post`, `put`, `patch`, `delete`)
- Each operation must have a `responses` object
- Each operation must have a `200` or `201` success response
- `openapi` version field must start with `"3"` (i.e., OpenAPI 3.x)

BAD: `"openapi": "2.0"` (Swagger 2.x). Operation missing `responses`. Path has no HTTP method.

GOOD:
```json
{
  "openapi": "3.0.3",
  "paths": {
    "/api/users": {
      "post": {
        "responses": {
          "201": { "description": "User created" },
          "400": { "description": "Invalid input" },
          "401": { "description": "Unauthorized" }
        }
      }
    }
  }
}
```

### AR008 — tests-pass
Finds all `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.mjs`, etc. in the route directory (recursive).

**Fails** if no test files are found — unlike coverage (AR009), this gate does not skip.

Runs vitest. Skips gracefully if vitest is not installed. All discovered test files must pass.

BAD: no test files, or any test failing.
GOOD: at least one `handler.test.ts` with all assertions passing.

### AR009 — coverage
Runs vitest with `--coverage`. Threshold: **80% statement coverage**.

Skips (passes) if: no test files found, vitest not installed, or coverage data unavailable. When coverage data is present, failing to reach 80% fails the gate.

Coverage is calculated across all non-test `.ts` source files within the route directory.

BAD: `coverage: 62% < 80%`.
GOOD: `coverage: 87% ≥ 80%`.

### AR010 — input-validated
Reads `handler.ts` specifically.

Any access to `req.body`, `req.query`, or `req.params` that appears **before** a `.parse()` or `.safeParse()` call fails the gate.

BAD:
```ts
const { email } = req.body;          // raw access before validation
const parsed = InputSchema.parse(req.body);
```
GOOD:
```ts
const parsed = InputSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: "Invalid" });
const { email } = parsed.data;       // using the parsed value, not req.body
```

### AR011 — contract-route
Reads `handler.ts` and `schema.ts`. Enforces the handler contract:

| Rule | Requirement |
|---|---|
| named-handler | `export async function handle` or `export const handle = async` |
| input-schema-export | `InputSchema` exported from `schema.ts` |
| error-envelope | Error responses use `{ error: ... }` shape |
| async-handler | Handler has a `try { } catch` block |
| auth-before-logic | Protected routes have an auth check (requireAuth, verifyToken, req.user, req.auth, Bearer) |

BAD: `export function handler(req, res)` — wrong name and not async. Returning `{ message: "fail" }` instead of `{ error: "fail" }`.

GOOD:
```ts
export async function handle(req, res) {
  try {
    // ...
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

### AR012 — cross-schema
Skips (passes) if no `schema-artifact.json` is found. When it exists, route fields must align with the compiled entity schema.

- Route `output` fields must be a subset of entity schema fields (meta fields exempt: `_count`, `__typename`, `meta`, `total`, `page`, `pageSize`, `cursor`, `hasMore`, `nextCursor`, `prevCursor`)
- For `POST`/`PUT`/`PATCH`: route `input` fields must also be a subset of entity schema fields

BAD: Route output includes `"profilePicture"` but `ts-schema` has no such field.
GOOD: Compile `ts-schema` first, then align route output to entity field names.

To fix: add the missing fields to `schema-spec.json` and re-compile `ts-schema`, or remove the unlisted fields from `route-spec.json`.

### AR013 — cross-auth
Passes for routes with `auth: "none"`.

For any protected route (`auth` is `bearer`, `session`, `api-key`, or `required`): `auth-artifact.json` must exist (searched in route dir, parent dir, `auth/` subdirectory). The artifact must have:
- `schema: "auth-artifact-v1"`
- `exports` array containing: `requireAuth`, `AuthError`, `TokenExpiredError`

BAD: Protected route but no auth-middleware compiler has been run yet.
FIX: Run `ogu compiler auth-middleware <slug>` before compiling this route.

### AR014 — cross-migration
Passes for GET routes with no database usage.

Database usage is detected if `handler.ts` references: `db`, `prisma`, `pool`, `knex`, `drizzle`, or `repository`.

When DB usage is detected: `migration-artifact.json` must exist (searched in route dir, parent dir, `migration/` subdirectory). The artifact must have `schema: "migration-artifact-v1"`.

BAD: Route creates a user record but `db-migration` has never been compiled.
FIX: Run `ogu compiler db-migration <slug>` before compiling this route.

---

## What This Compiler Never Forgives

- `schema.ts` missing from the route directory (AR002 hard-fails — no skip)
- `openapi.json` missing or not OpenAPI 3.x (AR007 hard-fails — no skip)
- No test files at all (AR008 hard-fails — unlike coverage which skips)
- `req.body`/`req.query`/`req.params` accessed before `.parse()`/`.safeParse()`
- Error responses that use `{ message: ... }` instead of `{ error: ... }`
- Handler not exported as `async function handle` (or `const handle = async`)
- Handler missing `try/catch`
- Raw SQL without `// @raw-sql-ok:` escape hatch
- Protected route with no `auth-artifact.json` compiled
- Route writing to DB with no `migration-artifact.json` compiled
