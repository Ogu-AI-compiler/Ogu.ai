# Transaction Script Module Compiler

## Purpose
Compiles a multi-write database transaction script. Every operation that touches ≥2 database tables or models **must** be wrapped in a single atomic boundary. No exceptions.

## Invariants (non-negotiable)

1. **≥2 writes** — A transaction script by definition coordinates multiple writes. If you only touch one model, use a plain service method instead.
2. **Single atomic boundary** — All writes must be inside `prisma.$transaction([...])`, `prisma.$transaction(async tx => { ... })`, `.transaction(trx => ...)`, `db.transaction(async tx => { ... })`, or `session.withTransaction(async () => { ... })`. Writes outside the boundary will be rejected.
3. **No HTTP inside transactions** — `fetch`, `axios`, `http.request`, `got`, `superagent` are banned inside transaction callbacks. Network calls block the DB connection and extend the transaction duration. Move them before or after the transaction boundary.
4. **Rollback on failure (manual transactions)** — If you use manual `BEGIN`/`COMMIT`, the `catch` block must call `.rollback()`. Prisma `$transaction` handles rollback automatically.
5. **Declared isolation level** — If `spec.isolationLevel` is non-default (e.g. `SERIALIZABLE`, `REPEATABLE READ`), the exact string must appear verbatim in the code passed to the ORM.

## Standard Patterns

### Prisma (recommended)
```typescript
// Interactive transaction (preferred — all writes share the same `tx`)
export async function transferFunds(from: string, to: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const debit = await tx.account.update({ where: { id: from }, data: { balance: { decrement: amount } } });
    const credit = await tx.account.update({ where: { id: to }, data: { balance: { increment: amount } } });
    await tx.ledger.create({ data: { fromId: from, toId: to, amount, type: 'TRANSFER' } });
    return { debit, credit };
  });
}
```

### Knex
```typescript
export async function createOrderWithItems(order: OrderInput, items: ItemInput[]) {
  const trx = await db.transaction();
  try {
    const [orderId] = await trx('orders').insert(order);
    await trx('order_items').insert(items.map(i => ({ ...i, order_id: orderId })));
    await trx.commit();
    return { orderId };
  } catch (err) {
    await trx.rollback(); // REQUIRED for manual transactions
    throw err;
  }
}
```

### Drizzle
```typescript
export async function archiveUser(userId: string) {
  return db.transaction(async (tx) => {
    await tx.update(users).set({ status: 'ARCHIVED' }).where(eq(users.id, userId));
    await tx.insert(auditLog).values({ userId, action: 'ARCHIVE', at: new Date() });
    return { archived: true };
  });
}
```

## spec format (`transaction-spec.json`)
```json
{
  "name": "transferFunds",
  "orm": "prisma",
  "writes": [
    { "model": "Account", "operation": "update" },
    { "model": "Account", "operation": "update" },
    { "model": "Ledger", "operation": "create" }
  ],
  "isolationLevel": "SERIALIZABLE"
}
```

## Error codes

| Code  | Meaning                                                  |
|-------|----------------------------------------------------------|
| TX001 | transaction-spec.json missing or invalid                 |
| TX002 | Write operations found outside transaction boundary      |
| TX003 | HTTP call (fetch/axios) found inside transaction block   |
| TX004 | Manual transaction missing .rollback() in catch block    |
| TX005 | Declared isolation level not present in code             |
| TX006 | TODO/FIXME/HACK comment found                            |
| TX007 | Tests failed                                             |
| TX008 | Transaction contract violation                           |

## What NOT to do

- Do not fire webhooks, send emails, or call external APIs inside the transaction callback.
- Do not read data from external sources (caches, HTTP) inside the transaction callback.
- Do not use `Promise.all([tx.modelA.update(), tx.modelB.update()])` with separate Prisma client instances — all reads/writes inside `$transaction` must use the `tx` argument.
- Do not swallow errors with empty `catch {}` blocks.
- Do not use `setTimeout` or `setInterval` inside transaction callbacks.
