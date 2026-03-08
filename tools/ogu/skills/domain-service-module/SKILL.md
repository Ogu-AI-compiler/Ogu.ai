---
name: domain-service-module
description: Compiler skill for the domain-service-module compiler. Activates when producing service-artifact.json. Gates: DS001–DS011. Upstream: optionally repository-artifact.json.
---

# domain-service-module — Compiler Skill

## What This Compiler Does

Compiles a typed domain service from a use case spec. Enforces that service files are framework-agnostic (no HTTP imports), config is injected (no process.env), methods return typed success+failure (no void), multi-write flows use transactions, and idempotent use cases have an explicit dedupe strategy.

**Upstream dependency:** optionally `repository-artifact.json`
**Output artifact:** `service-artifact.json`
**IR identifier:** `SERVICE`
**Service file naming:** `*.service.ts` (e.g. `user.service.ts`)

---

## Spec Shape

```json
{
  "name": "user-service",
  "useCases": [
    {
      "name": "createUser",
      "idempotent": true,
      "dedupeStrategy": "unique-email-constraint"
    },
    {
      "name": "getUserById"
    },
    {
      "name": "deleteUser",
      "multiWrite": true
    }
  ],
  "dependencies": [
    { "name": "userRepository",    "type": "repository" },
    { "name": "cacheClient",       "type": "cache" },
    { "name": "eventPublisher",    "type": "event-publisher" },
    { "name": "config",            "type": "config" }
  ]
}
```

Valid `dependency.type` values: `repository` | `service-client` | `cache` | `event-publisher` | `config` | `queue-producer`

`idempotent` and `multiWrite` are optional per-use-case flags.
`dedupeStrategy` is required in the spec when `idempotent: true` (DS011 SVC-004 checks this).

---

## Gates

### DS001 — spec-valid
Reads `service-spec.json`. Fails if missing or invalid JSON.

Required fields: `name` (string), `useCases` (non-empty array), `dependencies` (array).

Each dependency entry must have `name`. If `type` is present, it must be one of the six valid values: `repository`, `service-client`, `cache`, `event-publisher`, `config`, `queue-producer`.

BAD: `"dependencies": "UserRepository"` — must be an array. `"type": "db-client"` — not in enum. `"useCases": []` — must have at least one.
GOOD: All use cases are objects; all dependencies have `name`; `type` (if present) is valid.

### DS002 — ts-valid
Finds a `*.service.ts` file (excluding test files). Fails if none found.

Runs `npx tsc --noEmit --skipLibCheck` against the project root tsconfig, or against the file directly if no tsconfig exists.

BAD: Service file has type errors — undefined properties, incorrect generics, missing return types.
GOOD: Clean compile with no TypeScript errors.

### DS003 — no-any
Scans all non-test `.ts` files (not `.d.ts`, not `.test.ts`).

Blocked patterns:
- `: any`
- `<any>`
- `as any`
- `Array<any>`
- `Promise<any>`

BAD: `async createUser(data: any): Promise<any>` — both input and return are untyped.
GOOD: `async createUser(data: CreateUserInput): Promise<User | DuplicateEmailError>`

### DS004 — no-http-imports
Only checks `*.service.ts` files (not other TS files).

Blocked import patterns:
- `from 'express'`
- `from 'fastify'`
- `from 'hapi'`
- `from 'koa'`
- `NextFunction`
- `FastifyRequest` / `FastifyReply`
- `Request` from an import statement
- `Response` from an import statement

Services are framework-agnostic — they must be callable from HTTP handlers, queues, CLI, or tests without modification.

BAD: `import { Request, Response } from 'express'` in `user.service.ts`.
GOOD: Accept a plain DTO object. The handler layer extracts data from `req` and passes it to the service.

### DS005 — no-env-access
Only checks `*.service.ts` files.

Blocks `process.env.[A-Za-z_]` (any env var access). Config must be injected via constructor dependency — not read directly from the environment.

BAD: `const dbUrl = process.env.DATABASE_URL;` in `user.service.ts`.
GOOD:
```ts
class UserService {
  constructor(private config: AppConfig) {}
  async createUser() {
    const url = this.config.databaseUrl; // typed, validated, injectable
  }
}
```

### DS006 — no-inline-multiwrite
Only checks `*.service.ts` files.

Fails when ≥2 distinct DB write operations appear in the same file without a transaction wrapper.

**Write operations detected:**
- `await *.create(`
- `await *.update(`
- `await *.delete(`
- `await *.upsert(`
- `await *.deleteMany(`
- `await *.updateMany(`
- `await *.createMany(`

**Transaction patterns (escape):**
- `$transaction(`
- `.transaction(`
- `BEGIN` / `COMMIT` / `ROLLBACK`

A crash between two sequential writes with no transaction leaves the database partially written. Delegate to a `transaction-script-module` instead.

BAD:
```ts
await this.userRepo.create({ id, email });
await this.profileRepo.create({ userId: id, bio }); // two writes, no transaction
```
GOOD:
```ts
// Delegate to a transaction script
await this.createUserWithProfile.execute({ id, email, bio });
// Or wrap explicitly:
await prisma.$transaction(async (tx) => {
  await tx.user.create({ data: { id, email } });
  await tx.profile.create({ data: { userId: id, bio } });
});
```

### DS007 — typed-results
Checks `*.service.ts` files.

Service methods must return typed success **and** typed failure — not `Promise<void>`.

**Blocked:** `async methodName(...): Promise<void>` — unless the method name contains `notify`, `log`, or `emit` (fire-and-forget is acceptable for those).

**Required:** At least one typed result pattern must appear in the service:
- `Result<T, E>` — Result monad
- `Either<L, R>` — Either monad
- `Promise<{ success: ... }>` — discriminated union
- `ServiceResult` / `DomainResult` — named wrapper types
- `| *Error` — union return type
- `Promise<T | SomeError>` — explicit error union

BAD: `async deleteUser(id: string): Promise<void>` — caller cannot know if delete succeeded.
GOOD:
```ts
async deleteUser(id: string): Promise<{ deleted: true } | UserNotFoundError> {
  const user = await this.repo.findById(id);
  if (!user) return new UserNotFoundError(id);
  await this.repo.delete(id);
  return { deleted: true };
}
```

### DS008 — idempotency-strategy
Skips if no use cases have `idempotent: true` in the spec.

When idempotent use cases exist, the service code must contain at least one idempotency mechanism:
- `idempotencyKey` / `idempotency_key`
- `uniqueId`
- `.upsert(`
- `findOrCreate`
- `ON CONFLICT`
- `INSERT ... IGNORE`
- `dedupeKey`
- `jobId:` (BullMQ unique job ID)

BAD: Spec has `"idempotent": true` for `processPayment` but service just calls `await this.repo.create(...)` — duplicate calls create duplicate records.
GOOD: `await this.repo.upsert({ where: { idempotencyKey }, create: data, update: {} })` or `ON CONFLICT (idempotency_key) DO NOTHING`.

### DS009 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files (excluding `node_modules`, `dist`, `.ogu`, `.git`, `coverage`).

Blocked markers: `TODO`, `FIXME`, `HACK`, `XXX` (word-boundary match).

### DS010 — tests-pass
Hard-fails if no test files found (`*.test.ts`, `*.spec.ts`, `*.test.mjs`, etc.).

Tries vitest first, then jest. Fails if neither is installed. All tests must pass.

### DS011 — contract-service
Validates four contract rules (SVC-001 through SVC-004) against `service-spec.json`:

| Rule | Check |
|---|---|
| SVC-001 | `spec.name` is a non-empty string |
| SVC-002 | `spec.useCases` is a non-empty array |
| SVC-003 | `spec.dependencies` is an array |
| SVC-004 | Idempotent use cases (`uc.idempotent: true`) must have `uc.dedupeStrategy` in the spec |

SVC-004 is the most commonly missed: when you mark a use case as `idempotent: true` you must also declare how deduplication is achieved via `dedupeStrategy` in the spec, AND implement it in code (DS008 checks the code; DS011 checks the spec declaration).

BAD: `{ "name": "processPayment", "idempotent": true }` — missing `dedupeStrategy`.
GOOD: `{ "name": "processPayment", "idempotent": true, "dedupeStrategy": "idempotency-key-upsert" }`

---

## What This Compiler Never Forgives

- `service-spec.json` missing (DS001 hard-fails)
- No `*.service.ts` file found (DS002 hard-fails)
- `Promise<void>` return on non-notify/log/emit service methods (DS007)
- `process.env.*` inside a service file — inject config via constructor (DS005)
- `import { Request, Response } from 'express'` or any HTTP framework import in a service file (DS004)
- Two or more await write calls without `$transaction` wrapper (DS006)
- `idempotent: true` with no `dedupeStrategy` in spec (DS011 SVC-004)
- No test files at all (DS010 hard-fails)
- `as any` / `: any` / `Promise<any>` in any non-test TypeScript file (DS003)
