---
name: event-consumer-module
description: Compiler skill for the event-consumer-module compiler. Activates when producing event-consumer-artifact.json. Gates: EC001–EC009. Upstream: optionally event-publisher-artifact.json.
---

# event-consumer-module — Compiler Skill

## What This Compiler Does

Compiles an event consumer with at-least-once delivery semantics. Enforces that every incoming event envelope is schema-validated before payload access, an idempotency record is persisted before processing, errors are classified into retryable vs. dead-letter, and subscriptions are scoped to declared channels only.

**Upstream dependency:** optionally `event-publisher-artifact.json`
**Output artifact:** `event-consumer-artifact.json`
**IR identifier:** `EVENT_CONSUMER:{eventType}`

---

## Spec Shape

```json
{
  "eventType": "user.created",
  "channels": ["user-events"],
  "handlerName": "UserCreatedConsumer",
  "idempotencyKey": "eventId",
  "publisherArtifact": "../user-event-publisher/event-publisher-artifact.json"
}
```

`publisherArtifact` is optional — a relative path to the compiled publisher artifact.

`idempotencyKey` must be one of: `"eventId"`, `"messageId"`, or a custom string describing the key field.

---

## Gates

### EC001 — spec-valid
Reads `event-consumer-spec.json`. Fails if missing or invalid JSON.

Required fields: `eventType` (string), `channels` (non-empty array of strings), `handlerName` (string), `idempotencyKey` (string).

BAD: `"channels": []` — must have at least one. Missing `handlerName` or `idempotencyKey`.
GOOD: All four required fields present; `channels` has at least one entry.

### EC002 — cross-publisher
Skips (passes) if `publisherArtifact` is not set in the spec.

When declared: the artifact file must exist and be valid JSON. Two checks:
1. `artifact.eventType` must equal `spec.eventType` — consumer must match the event it was built for
2. `artifact.channel` must be in `spec.channels` — the publisher's channel must be a declared consumer channel

BAD: Publisher artifact has `"eventType": "user.updated"` but spec declares `"user.created"`.
BAD: Publisher publishes on `"user-events-v2"` but consumer only declares `["user-events"]`.
GOOD: Compile the publisher first; ensure `eventType` and `channel` align.

FIX: Run `event-publisher-module` compiler first, then reference its output artifact in `publisherArtifact`.

### EC003 — envelope-validated-on-receipt
Scans all non-test `.ts`/`.mjs`/`.js` files.

At every line where `event.payload`, `event.data`, `msg.payload`, `msg.data`, `message.payload`, `message.data`, or `envelope.payload`/`envelope.data` is accessed, the gate checks the **20 lines before** that access for a schema validation call (`.parse(`, `.safeParse(`, or `.validate(`).

If no payload access is found at all, the gate skips (passes).

BAD:
```ts
async handle(event: unknown) {
  const userId = (event as any).payload.userId; // no validation before access
}
```
GOOD:
```ts
async handle(rawEvent: unknown) {
  const event = UserCreatedSchema.parse(rawEvent); // validates first
  const userId = event.payload.userId;             // safe to access
}
```

### EC004 — idempotency-persisted
Scans all non-test source files for an idempotency persistence pattern. At least one of these must appear:

- `redis.set(... event.id ...` / `redis.setnx(... messageId` — Redis NX write with event ID
- `.findUnique(... idempotency ...` — DB lookup by idempotency key
- `.upsert(... idempotency ...` — DB upsert with idempotency key
- `alreadyProcessed` / `isProcessed` / `isDuplicate` / `seenBefore` — dedup flag variable
- `processedEvents.has(` / `processedEvents.add(` — in-memory dedup set

This check is required because at-least-once delivery means the same event can arrive multiple times. Without persisting a "seen" record before processing, duplicate events cause duplicate side effects.

BAD:
```ts
async handle(event: UserCreatedEvent) {
  await this.userService.createUser(event.payload); // no dedup check — will re-create on retry
}
```
GOOD:
```ts
async handle(event: UserCreatedEvent) {
  const seen = await redis.set(`processed:${event.id}`, "1", { NX: true, EX: 86400 });
  if (!seen) return; // already processed
  await this.userService.createUser(event.payload);
}
```

### EC005 — errors-classified
Scans all non-test source files for error classification.

**Passes if any of these are present:**
- `dead-letter` / `dlq` / `DeadLetter` / `deadLetter` (case-insensitive)
- `ack(false)` / `nack(` / `reject(` — AMQP-style acknowledgement rejection
- `NonRetryable` / `UnrecoverableError` / `PermanentError` — error class names
- `move...dead` / `sendToDlq` / `deadLetterQueue` — explicit DLQ routing

**Also passes** if a `try { }` block exists (with a warning that DLQ classification is recommended).

**Fails** only if there is no error handling at all — no DLQ patterns and no `try { }` block.

BAD: Handler has no try/catch and no error classification at all.
GOOD:
```ts
try {
  await this.userService.createUser(event.payload);
} catch (err) {
  if (err instanceof ValidationError) {
    await this.dlq.send({ event, error: err.message }); // dead-letter non-retryable
  } else {
    throw err; // rethrow retryable errors for broker retry
  }
}
```

### EC006 — channel-scoped
Scans all non-test source files for subscription calls with string literal channel arguments:
`.subscribe('...')`, `.on('...')`, `.listen('...')`, `.consume('...')`

Every string literal channel used in a subscribe call must be in `spec.channels`.

BAD: `client.subscribe('internal-debug-events')` when `spec.channels` only has `["user-events"]`.
GOOD: All subscriptions use only channels declared in `spec.channels`, or use variables (not literal strings) that map to declared channels.

### EC007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### EC008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### EC009 — contract-event-consumer
Reads `event-consumer-artifact.json` (compiler-generated). Required fields: `ir_id`, `eventType`, `channels`, `handlerName`, `attestation`.

- `ir_id` must start with `EVENT_CONSUMER:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `event-consumer-spec.json` missing (EC001 hard-fails)
- `event.payload` / `event.data` accessed without schema validation in the 20 lines before it (EC003)
- No idempotency persistence — at-least-once delivery requires a dedup check before processing (EC004)
- No error handling at all — no try/catch, no DLQ routing (EC005)
- Subscribing to a channel not declared in `spec.channels` (EC006)
- `publisherArtifact` declared but file not found, or eventType mismatch (EC002)
- No test files (EC008 hard-fails)
