# Seed Scenario Module Compiler

You are building a **seed scenario module** — a deterministic, idempotent data fixture that populates a database with known state for testing or development.

## Invariants (non-negotiable)

1. **Upsert only** — every write must be idempotent. Use `upsert`, `createOrUpdate`, or `INSERT ... ON CONFLICT DO UPDATE`. Bare `create()` or raw `INSERT INTO` fails gate SS003 unless marked `// @bare-insert-ok: reason`.
2. **No random data** — all seed values must be hardcoded constants. No `Math.random()`, `faker.*`, `uuid()`, `nanoid()`. Violates gate SS004. Escape: `// @random-seed-ok: reason`, or set `spec.allowRandom: true`.
3. **Cleanup exported** — every seed module must export a `teardown()` / `cleanup()` / `reset()` function that reverses the seed. Violates gate SS005. Exception: `spec.environment === 'development'`.
4. **No real PII** — no real SSNs, credit card numbers, Gmail/Yahoo addresses, or real phone numbers. Use `test@example.com`, `+1-555-0100`, `4111111111111111` (test card). Violates gate SS006.
5. **Seed order respected** — `spec.seedOrder` defines insertion order for FK constraints. Always seed in the declared order.
6. **No TODOs** — no `TODO`, `FIXME`, or `HACK` comments. Violates gate SS007.
7. **Tests pass** — all `.test.ts`/`.spec.mjs` files pass. Violates gate SS008.

## Spec format

```json
{
  "scenarioId": "standard-company-with-users",
  "description": "A company with 3 users — admin, manager, member",
  "environment": "test",
  "entities": ["Company", "User", "Role"],
  "seedOrder": ["Company", "Role", "User"],
  "allowRandom": false
}
```

## Standard pattern (Prisma)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY = {
  id: 'seed-company-001',
  name: 'Acme Corp',
  slug: 'acme-corp',
};

const USERS = [
  { id: 'seed-user-admin', email: 'admin@example.com', role: 'ADMIN' },
  { id: 'seed-user-mgr',   email: 'manager@example.com', role: 'MANAGER' },
  { id: 'seed-user-mem',   email: 'member@example.com',  role: 'MEMBER' },
];

export async function seed() {
  // Seed order: Company → User (FK: user.companyId → company.id)
  const company = await prisma.company.upsert({
    where: { id: COMPANY.id },
    update: {},
    create: COMPANY,
  });

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: { ...u, companyId: company.id },
    });
  }

  return { company, users: USERS };
}

export async function teardown() {
  await prisma.user.deleteMany({ where: { id: { in: USERS.map(u => u.id) } } });
  await prisma.company.delete({ where: { id: COMPANY.id } });
}
```

## What NOT to do

```typescript
// ✗ Bare create — fails on second run (SS003)
await prisma.user.create({ data: { email: 'user@example.com' } });

// ✗ Random ID — non-deterministic (SS004)
await prisma.user.upsert({ where: { id: uuid() }, ... });

// ✗ Real email domain (SS006)
const email = 'alice@gmail.com';

// ✗ No teardown — test isolation broken (SS005)
export async function seed() { ... }
// (missing teardown export)

// ✗ Faker — non-deterministic (SS004)
import { faker } from '@faker-js/faker';
const name = faker.company.name();
```

## Escape hatches

| Annotation | Gate bypassed | Use when |
|---|---|---|
| `// @bare-insert-ok: reason` | SS003 | Insert-only table, truly no re-run risk |
| `// @random-seed-ok: reason` | SS004 | Intentional fuzz data, `spec.allowRandom: true` preferred |

## Error codes

| Code | Gate | Meaning |
|------|------|---------|
| SS001 | spec-valid | `seed-scenario-spec.json` missing or invalid |
| SS002 | spec-valid | `scenarioId` invalid format or entities/seedOrder mismatch |
| SS003 | upsert-only | Bare `create()` / `INSERT INTO` without upsert guard |
| SS004 | no-random-data | Non-deterministic data generation found |
| SS005 | cleanup-declared | No teardown/cleanup/reset export found |
| SS006 | no-prod-data | Real PII pattern detected in seed files |
| SS007 | no-todos | TODO/FIXME/HACK comment found |
| SS008 | tests-pass / contract | Tests failed or artifact contract invalid |

## Artifact output

The compiler writes `seed-scenario-artifact.json`:

```json
{
  "ir_id": "SEED_SCENARIO:standard-company-with-users",
  "scenarioId": "standard-company-with-users",
  "description": "...",
  "environment": "test",
  "entities": ["Company", "User", "Role"],
  "seedOrder": ["Company", "Role", "User"],
  "allowRandom": false,
  "hasCleanup": true,
  "attestation": {
    "hash": "abc123...",
    "compiledAt": "2026-03-08T00:00:00.000Z",
    "gates": [...]
  }
}
```
