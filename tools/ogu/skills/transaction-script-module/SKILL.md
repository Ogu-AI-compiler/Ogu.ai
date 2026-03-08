---
name: transaction-script-module
description: Compiler skill for the transaction-script-module compiler. Activates when producing transaction-artifact.json. Gates: TX001–TX008. Upstream: optionally repository-artifact.json.
---

# transaction-script-module — Compiler Skill

## What This Compiler Does

Compiles multi-write transactional workflows. Enforces that all DB writes occur inside a single transaction boundary, no HTTP calls happen inside the transaction, the failure path rolls back (automatically via ORM or explicitly via `.rollback()`), and non-default isolation levels are declared in code when required.

**Upstream dependency:** optionally `repository-artifact.json`
**Output artifact:** `transaction-artifact.json`
**IR identifier:** `TRANSACTION:{name}`

---

## Spec Shape

```json
{
  "name": "transfer-credits",
  "orm": "prisma",
  "writes": [
    { "model": "User",        "operation": "update" },
    { "model": "Transaction", "operation": "create" },
    { "model": "Ledger",      "operation": "create" }
  ],
  "isolationLevel": "SERIALIZABLE"
}
```

`writes` must have **at least 2 entries** — the spec enforces this. Single-write operations belong in `domain-service-module`, not here.

`orm` must be one of: `prisma` | `drizzle` | `knex` | `typeorm`

`isolationLevel` is optional. When absent or set to `"READ COMMITTED"` (the Postgres default), the isolation gate (TX005) skips. Any other value (`"SERIALIZABLE"`, `"REPEATABLE READ"`, `"READ UNCOMMITTED"`) requires the level to be declared in code.

The transaction implementation file must match: `*.tx.ts`, `*transaction*.ts`, or `*Tx.ts` (not test files).

---

## Gates

### TX001 — spec-valid
Reads `transaction-spec.json`. Fails if missing or invalid JSON.

Required fields: `name` (string), `orm` (prisma|drizzle|knex|typeorm), `writes` (array with ≥2 entries).

BAD: `"writes": [{ "model": "User" }]` — only 1 write, use `domain-service-module` instead. `"orm": "sequelize"` — not in valid set.
GOOD:
```json
{
  "name": "transfer-credits",
  "orm": "prisma",
  "writes": [
    { "model": "User",        "operation": "update" },
    { "model": "Transaction", "operation": "create" }
  ]
}
```

### TX002 — writes-in-transaction
Finds files matching `*.tx.ts`, `*transaction*.ts`, or `*Tx.ts` (excluding `.test.` files). Hard-fails if no such file found.

Tracks brace nesting depth to distinguish inside/outside the transaction callback. DB write operations outside the transaction boundary are flagged:
- `await *.create/update/delete/upsert/createMany/updateMany/deleteMany(`
- `await *.insert(`
- `INSERT INTO` / `UPDATE * SET` / `DELETE FROM` (raw SQL)

BAD:
```ts
// Outside transaction — partial write if second fails
await prisma.user.update({ where: { id }, data: { credits: newCredits } });
await prisma.transaction.create({ data: txRecord }); // orphaned if this throws
```
GOOD:
```ts
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { credits: newCredits } }),
  prisma.transaction.create({ data: txRecord }),
]);
```

### TX003 — no-http-in-transaction
Scans the content following transaction markers (`$transaction`, `.transaction(`, `knex.transaction`, `db.transaction`) for HTTP calls: `fetch(`, `axios.`, `http.request`, `https.request`, `got(`, `superagent.`.

HTTP calls inside a DB transaction hold the connection open. If the upstream API is slow, the DB connection is blocked, causing connection pool exhaustion.

BAD:
```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.update(...);
  await axios.post('https://notify.service/webhook', { userId }); // blocks connection
  await tx.ledger.create(...);
});
```
GOOD:
```ts
// Gather external data BEFORE the transaction
const webhookData = await prepareWebhookPayload(userId);

await prisma.$transaction(async (tx) => {
  await tx.user.update(...);
  await tx.ledger.create(...);
});

// Notify AFTER the transaction commits
await axios.post('https://notify.service/webhook', webhookData);
```

### TX004 — rollback-on-failure
**Auto-rollback** (gate passes automatically): Prisma `$transaction(` and MongoDB `session.withTransaction` roll back automatically on exception — no extra code needed.

**Manual transactions** (`knex.transaction`, `BEGIN`, `db.transaction`) require explicit rollback:
- `.rollback(` call
- `ROLLBACK` SQL statement
- `trx.rollback`

BAD (manual transaction without rollback):
```ts
const trx = await knex.transaction();
await trx('users').update({ credits: newCredits });
await trx('transactions').insert(txRecord);
await trx.commit(); // if this fails, no rollback
```
GOOD:
```ts
const trx = await knex.transaction();
try {
  await trx('users').update({ credits: newCredits });
  await trx('transactions').insert(txRecord);
  await trx.commit();
} catch (err) {
  await trx.rollback();
  throw err;
}
```

### TX005 — isolation-declared
Skips if `spec.isolationLevel` is absent or equals `"READ COMMITTED"` (Postgres default).

When a non-default level is declared (e.g. `"SERIALIZABLE"`, `"REPEATABLE READ"`), the transaction files must contain one of:
- `isolationLevel` — Prisma option key
- `Isolation.` — Prisma enum
- `SERIALIZABLE` / `REPEATABLE READ` / `READ UNCOMMITTED`
- `SET TRANSACTION ISOLATION LEVEL`

BAD: `spec.isolationLevel: "SERIALIZABLE"` but transaction file has no `isolationLevel` option.
GOOD:
```ts
await prisma.$transaction(
  async (tx) => { ... },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
);
```

### TX006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### TX007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### TX008 — contract-transaction
Reads the compiler-generated `transaction-artifact.json`. Required fields: `ir_id`, `name`, `writes[]`, `orm`, `attestation`.

- `ir_id` must start with `TRANSACTION:`
- `writes[]` must have ≥2 entries
- Every entry in `artifact.writes` must appear in `spec.writes` (as `model` name)
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `transaction-spec.json` missing (TX001 hard-fails)
- `writes[]` with fewer than 2 entries — use `domain-service-module` for single writes (TX001)
- `orm` not in `prisma` | `drizzle` | `knex` | `typeorm` (TX001)
- No transaction script file found (`*.tx.ts`, `*transaction*.ts`) (TX002 hard-fails)
- DB write operations detected outside transaction boundary (TX002)
- `fetch(`, `axios.`, or other HTTP calls inside the transaction callback (TX003)
- Manual transaction (`knex.transaction`, `BEGIN`) without explicit `.rollback()` on failure path (TX004)
- `spec.isolationLevel` set to non-default but not declared in transaction code (TX005)
- No test files (TX007 hard-fails)
- `artifact.writes` includes entity not in `spec.writes` (TX008)
