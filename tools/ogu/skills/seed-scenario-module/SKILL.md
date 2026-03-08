---
name: seed-scenario-module
description: Compiler skill for the seed-scenario-module compiler. Activates when producing seed-scenario-artifact.json. Gates: SS001–SS008. No upstream dependency.
---

# seed-scenario-module — Compiler Skill

## What This Compiler Does

Compiles a deterministic, idempotent database seed scenario. Enforces that seeds use upsert operations (not bare inserts), all data is fixed (no random values), a cleanup/teardown function is exported, and no real production data patterns appear in seed values.

**Upstream dependency:** none
**Output artifact:** `seed-scenario-artifact.json`
**IR identifier:** `SEED_SCENARIO:{scenarioId}`

---

## Spec Shape

```json
{
  "scenarioId": "test-base",
  "description": "Baseline users and orgs for integration tests",
  "entities": ["User", "Organization", "Membership"],
  "seedOrder": ["Organization", "User", "Membership"],
  "environment": "test"
}
```

`entities` — all entity types seeded in this scenario.

`seedOrder` — the order to seed entities, respecting foreign key dependencies. Every entity listed in `entities` must appear in `seedOrder`.

`environment` — optional. Setting `"development"` skips the cleanup-declared gate (SS004) — dev seeds don't need teardown.

`allowRandom: true` — optional. Skips the no-random-data gate (SS003). Use only when reproducibility is not required.

---

## Gates

### SS001 — spec-valid
Reads `seed-scenario-spec.json`. Fails if missing or invalid JSON.

Required fields: `scenarioId`, `description`, `entities` (non-empty array), `seedOrder` (non-empty array).

Extra constraint: every entity in `entities[]` must also appear in `seedOrder[]`. Omissions fail here.

BAD: `entities: ["User", "Organization"]` but `seedOrder: ["User"]` — Organization missing from seedOrder.
GOOD: All entities present in both arrays, with seedOrder respecting FK dependencies.

### SS002 — upsert-only
Scans seed and fixture source files (files with `seed` or `fixture` in name first; if none found, scans all non-test `.ts`/`.mjs`/`.js`).

**Blocked** (bare inserts without upsert alternative):
- `prisma.*.create({ data:` — direct ORM create
- `db.insert(` / `.insert([`
- `INSERT INTO` without `ON CONFLICT`

**Required** (at least one upsert pattern in the file to pass):
- `.upsert(` — Prisma upsert
- `.createOrUpdate` — generic
- `insertOrIgnore` — Knex/SQLite
- `ON CONFLICT` — SQL upsert clause
- `createMany.*skipDuplicates` — Prisma batch upsert

**Escape hatch:** add `// @bare-insert-ok` on the same line as the bare insert.

BAD:
```ts
await prisma.user.create({ data: { id: 'seed-user-1', email: 'test@example.com' } });
// fails on second run with duplicate key error
```
GOOD:
```ts
await prisma.user.upsert({
  where: { id: 'seed-user-1' },
  update: {},
  create: { id: 'seed-user-1', email: 'test@example.com' },
});
```

### SS003 — no-random-data
Skips entirely if `spec.allowRandom: true`.

Otherwise blocks these patterns on non-comment lines:
- `Math.random()`
- `crypto.randomUUID()`
- `nanoid()`
- `faker.*.*()`  — any Faker.js call
- `uuidv4()` / `uuid()`

**Escape hatch:** add `// @random-seed-ok` on the same line.

Random data in seeds breaks test reproducibility — the same seed produces different data on each run, making snapshot tests and expectations non-deterministic.

BAD:
```ts
const user = { id: uuid(), email: faker.internet.email() }; // different every run
```
GOOD:
```ts
const user = { id: 'seed-user-001', email: 'test-user-001@example.com' }; // stable
```

### SS004 — cleanup-declared
Skips if `spec.environment === 'development'` (dev seeds don't need teardown).

For test and other environments, requires an exported cleanup function matching one of these patterns:
- `export async function teardown(`
- `export async function cleanup(`
- `export async function reset(`
- `export async function rollback(`
- `export async function clear(`
- `exports.teardown =` / `exports.cleanup =` / `exports.reset =` / `exports.clear =`

BAD: No cleanup function exported — test suite leaks seed data between runs.
GOOD:
```ts
export async function teardown() {
  await prisma.membership.deleteMany({ where: { id: { in: SEED_MEMBERSHIP_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: SEED_USER_IDS } } });
  await prisma.organization.deleteMany({ where: { id: { in: SEED_ORG_IDS } } });
}
```

### SS005 — no-prod-data
Scans all `.ts`, `.mjs`, `.js`, `.json` files (excluding spec and artifact JSON).

Checks for suspicious production data patterns:
- **SSN**: `\d{3}-\d{2}-\d{4}` format
- **Credit card**: Visa (4xxx), Mastercard (5[1-5]xxx), Amex (3[47]xxx) patterns
- **Real email domains**: `@gmail.`, `@yahoo.`, `@hotmail.`, `@outlook.`, `@company.`, `@corp.`
- **Real phone**: E.164 US numbers `+1[2-9]\d{9}` or bare `[2-9]\d{9}`

Lines containing these safe keywords are exempted: `test`, `example`, `fake`, `dummy`, `seed`, `mock`, `sample`, `placeholder`, `foo`, `bar`.

BAD:
```ts
const user = { phone: '+14155552671', email: 'john.doe@gmail.com', ssn: '123-45-6789' };
```
GOOD:
```ts
const user = { phone: '+15550001234', email: 'test-user@example.com' };
// 555-xxxx numbers and example.com domain are safe
```

### SS006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### SS007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### SS008 — contract-seed-scenario
Reads the compiler-generated `seed-scenario-artifact.json`. Required fields: `ir_id`, `scenarioId`, `entities`, `seedOrder`, `attestation`.

- `ir_id` must start with `SEED_SCENARIO:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `seed-scenario-spec.json` missing (SS001 hard-fails)
- `entities` empty array (SS001)
- `seedOrder` empty array (SS001)
- Entity in `entities[]` not present in `seedOrder[]` (SS001)
- Bare `prisma.*.create(` or `INSERT INTO` without `ON CONFLICT` — not idempotent (SS002)
- `Math.random()`, `faker.*.*()`, `uuid()` in seed without `spec.allowRandom: true` or `// @random-seed-ok` (SS003)
- No exported `teardown`/`cleanup`/`reset` function for non-development seeds (SS004)
- SSN, credit card, real email domain, or real phone pattern in seed files (SS005)
- No test files (SS007 hard-fails)
