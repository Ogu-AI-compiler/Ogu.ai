---
name: orm-repository-module
description: Compiler skill for the orm-repository-module compiler. Activates when producing repository-artifact.json. Gates: OR001–OR012. Upstream: optionally migration-artifact.json.
---

# orm-repository-module — Compiler Skill

## What This Compiler Does

Compiles a typed ORM repository module. Enforces that the repository is framework-agnostic (no HTTP imports, no network calls), all paginated reads have stable ordering, write and delete methods return typed results (not void), and raw SQL is either absent or explicitly annotated with an escape hatch.

**Upstream dependency:** optionally `migration-artifact.json`
**Output artifact:** `repository-artifact.json`
**IR identifier:** `REPOSITORY`

---

## Spec Shape

```json
{
  "entity": "User",
  "orm": "prisma",
  "migrationArtifact": "../db-migration/migration-artifact.json",
  "methods": [
    { "name": "findById",  "type": "read",   "returns": "User | null" },
    { "name": "findMany",  "type": "read",   "paginated": true, "returns": "User[]" },
    { "name": "create",    "type": "write",  "returns": "User" },
    { "name": "update",    "type": "write",  "returns": "User" },
    { "name": "delete",    "type": "delete", "returns": "{ deleted: boolean }" }
  ]
}
```

`orm` must be one of: `prisma` | `drizzle` | `knex` | `typeorm`

`migrationArtifact` is optional — a relative path to the compiled migration artifact.

`methods[].type` must be one of: `read` | `write` | `delete`

`methods[].paginated: true` activates the ordering gate (OR007) for that method. Any `type: "read"` method whose name contains "list" also activates the ordering check.

`methods[].returns` is required on write/delete methods — must be a non-void, non-empty string. The contract (OR012) checks this field on write and delete methods in the spec.

---

## Gates

### OR001 — spec-valid
Reads `repository-spec.json`. Fails if missing or invalid JSON.

Required fields: `entity` (string), `orm` (one of `prisma`, `drizzle`, `knex`, `typeorm`), `methods` (non-empty array).

Each method must have `name` (string) and `type` (`read` | `write` | `delete`).

BAD: `"orm": "sequelize"` — not in the valid set. `"methods": []` — empty array. Method missing `type`.
GOOD:
```json
{
  "entity": "User",
  "orm": "prisma",
  "methods": [
    { "name": "findById", "type": "read",  "returns": "User | null" },
    { "name": "create",   "type": "write", "returns": "User" }
  ]
}
```

### OR002 — cross-migration
Skips (passes) if `migrationArtifact` is not set in the spec.

When declared: the artifact file must exist and be valid JSON. `artifact.table` must match `spec.entity.toLowerCase()` or `spec.entity.toLowerCase() + 's'` (naive pluralization).

BAD: `migrationArtifact` points to a file that declares `"table": "orders"` but `spec.entity` is `"User"`.
FIX: Compile `db-migration` first (`ogu compiler db-migration <slug>`), then set `migrationArtifact` to its output path.
GOOD: Migration artifact has `"table": "users"` and spec has `"entity": "User"`.

### OR003 — ts-valid
Looks for a repository `.ts` file matching `*.repo.ts` or `*Repository.ts` anywhere in the module directory.

Fails if no such file is found. Runs `npx tsc --noEmit --skipLibCheck` — the file must compile without TypeScript errors.

BAD: `user.repository.ts` has a type mismatch — method declared `findById(id: string): Promise<User>` but returns `Promise<UserWithPassword>` which is not assignable.
GOOD: The repository file passes `tsc --noEmit` cleanly.

### OR004 — no-any
Scans all non-test `.ts` files (excluding `node_modules`, `dist`, `.git`, `.test.` files).

Blocked patterns on non-comment lines:
- `: any` — explicit any annotation
- `<any>` — generic any
- `as any` — type assertion to any
- `Array<any>`
- `Promise<any>`

BAD: `async findById(id: string): Promise<any>` — promise of any.
BAD: `const result: any = await prisma.user.findUnique(...)` — typed as any.
GOOD: `async findById(id: string): Promise<User | null>`

### OR005 — no-http-imports
Only scans files matching `.repo.` or `repository` in the filename.

Blocked imports in repository files:
- `from 'express'` / `from 'fastify'` / `from 'hapi'` / `from 'koa'`
- Types: `Request`, `Response`, `NextFunction`, `FastifyRequest`, `FastifyReply`

Repositories are pure data access — they must know nothing about HTTP or the framework layer.

BAD:
```ts
import { Request } from 'express'; // in user.repository.ts
```
GOOD: Repository only imports ORM client, types, and domain interfaces.

### OR006 — no-network-calls
Only scans `.repo.` or `repository` files.

Blocked patterns:
- `fetch(` — native fetch
- `axios.get/post/put/patch/delete(`
- `http.request(` / `https.request(`
- `got(`
- `superagent.`
- `needle.`
- `request('https?:...)`

Repositories only access the database. HTTP calls belong in `service-client-module`.

BAD: `const externalData = await fetch('https://api.example.com/users')` — inside a repository file.
GOOD: All external API calls moved to a separate service client.

### OR007 — paginated-ordered
Activates when any method has `paginated: true` in the spec, OR has `type: "read"` with "list" in the method name.

Scans the repository file for pagination patterns (`take:`, `skip:`, `limit:`, `offset:`, `findMany(`, `.paginate(`, `cursor:`). If a pagination pattern is found, ordering patterns must also be present (`orderBy:`, `ORDER BY`, `order:`, `sort:`, `sortBy`).

Pagination without ordering returns non-deterministic pages — rows can appear on multiple pages or be skipped between requests.

BAD:
```ts
async listUsers(skip: number, take: number): Promise<User[]> {
  return prisma.user.findMany({ skip, take }); // no orderBy
}
```
GOOD:
```ts
async listUsers(skip: number, take: number): Promise<User[]> {
  return prisma.user.findMany({
    skip,
    take,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // stable ordering
  });
}
```

### OR008 — typed-returns
Write and delete methods (type `"write"` or `"delete"` in spec) must not declare `void` or `Promise<void>` as their return type in the repository implementation.

The gate scans the repository file for the method signature and checks for void return annotation.

BAD:
```ts
async create(dto: CreateUserDto): Promise<void> {  // blocked
  await prisma.user.create({ data: dto });
}
```
GOOD:
```ts
async create(dto: CreateUserDto): Promise<User> {
  return prisma.user.create({ data: dto });
}

async delete(id: string): Promise<{ deleted: boolean }> {
  await prisma.user.delete({ where: { id } });
  return { deleted: true };
}
```

### OR009 — no-raw-sql
Scans repository files for raw SQL patterns. Blocked without escape hatch:
- `$queryRaw\`` — Prisma raw query
- `$executeRaw\`` — Prisma raw execute
- `knex.raw(` — Knex raw
- `db.query(` — generic DB query
- `.raw(` — any ORM `.raw` call
- `query("SELECT..."` / `query(\`INSERT...` — string-prefixed SQL queries

**Escape hatch:** add `// @raw-sql-ok: <reason>` within the 3 lines before the raw SQL call.

BAD:
```ts
const results = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```
GOOD (with escape hatch):
```ts
// @raw-sql-ok: Requires database-specific JSON aggregation not supported by Prisma ORM
const results = await prisma.$queryRaw`SELECT json_agg(...) FROM users`;
```

### OR010 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### OR011 — tests-pass
Hard-fails if no test files found (`*.test.ts`, `*.spec.ts`, `*.test.mjs`, etc.). Tries vitest first, then jest. All tests must pass.

### OR012 — contract-repository
Validates three contract rules (REPO-001 through REPO-003) from `repository.contract.json`:

| Rule | Check |
|---|---|
| REPO-001 | `spec.entity` must be a non-empty string |
| REPO-002 | `spec.orm` must be one of: `prisma`, `drizzle`, `knex`, `typeorm` |
| REPO-003 | Write/delete methods in spec must declare a `returns` field (non-void, non-empty) |

REPO-003 is critical: every method with `type: "write"` or `type: "delete"` must have a `returns` field in the spec JSON. A missing or empty `returns` fails the contract even if the implementation itself compiles.

BAD spec:
```json
{ "name": "create", "type": "write" }
```
GOOD spec:
```json
{ "name": "create", "type": "write", "returns": "User" }
```

---

## What This Compiler Never Forgives

- `repository-spec.json` missing (OR001 hard-fails)
- `orm` value not in `prisma` | `drizzle` | `knex` | `typeorm` (OR001)
- `methods` empty array (OR001)
- Method missing `name` or `type` (OR001)
- `migrationArtifact` declared but artifact not found — compile db-migration first (OR002)
- Migration table doesn't match entity name (OR002)
- No `*.repo.ts` or `*Repository.ts` file found (OR003)
- TypeScript compilation errors in repository file (OR003)
- `: any`, `as any`, `Promise<any>` in any `.ts` source file (OR004)
- HTTP framework imports (`express`, `fastify`) in repository file (OR005)
- Network calls (`fetch`, `axios`, `got`) in repository file (OR006)
- Paginated method without stable `orderBy` (OR007)
- Write/delete method returning `void` or `Promise<void>` (OR008)
- Raw SQL without `// @raw-sql-ok:` escape hatch in preceding 3 lines (OR009)
- No test files (OR011 hard-fails)
- Write/delete method missing `returns` in spec JSON (OR012 REPO-003)
