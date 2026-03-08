---
name: job-worker-module
description: Compiler skill for the job-worker-module compiler. Activates when producing job-worker-artifact.json. Gates: JW001–JW009. Upstream: optionally job-producer-artifact.json.
---

# job-worker-module — Compiler Skill

## What This Compiler Does

Compiles a BullMQ/Bull job worker. Enforces that the job payload is validated on receipt before any use of `job.data`, idempotency is checked if declared, errors are classified as retryable vs. non-retryable (via `UnrecoverableError`), and no unawaited async calls exist inside the processor function.

**Upstream dependency:** optionally `job-producer-artifact.json`
**Output artifact:** `job-worker-artifact.json`
**IR identifier:** `JOB_WORKER:{jobName}`

---

## Spec Shape

```json
{
  "jobName": "send-email",
  "queueName": "email-queue",
  "payloadSchema": "SendEmailPayloadSchema",
  "concurrency": 5,
  "idempotencyKey": "jobId",
  "producerArtifact": "../email-producer/job-producer-artifact.json"
}
```

`concurrency` is required and must be a positive number.
`idempotencyKey` is optional — when present, enables the idempotency check gate (JW004).
`producerArtifact` is optional — a relative path to the compiled producer artifact.

---

## Gates

### JW001 — spec-valid
Reads `job-worker-spec.json`. Fails if missing or invalid JSON.

Required fields: `jobName` (string), `queueName` (string), `payloadSchema` (string), `concurrency` (positive number).

BAD: `"concurrency": 0` — must be ≥1. `"concurrency": "5"` — must be a number. Missing `payloadSchema`.
GOOD: `{ "jobName": "send-email", "queueName": "email-queue", "payloadSchema": "SendEmailPayloadSchema", "concurrency": 5 }`

### JW002 — cross-producer
Skips (passes) if `producerArtifact` is not set in the spec.

When declared: the artifact file must exist and be valid JSON. `producer.queueName` must equal `spec.queueName`.

BAD: Producer artifact has `"queueName": "email-queue"` but worker spec says `"queueName": "email-v2-queue"`.
GOOD: Compile the job producer first; ensure both worker and producer target the same queue.

### JW003 — payload-validated-on-receipt
Finds processor functions by detecting: `Worker`, `worker`, `processor`, `.process(`, `async (job)`, or `async(job)` patterns in source files.

At every `job.data.*` access, checks the **30 lines before** that access for a validation call:
- Must contain `spec.payloadSchema` name (e.g. `SendEmailPayloadSchema`)
- Must contain `.parse(`, `.safeParse(`, or `.validate(`

Also fails if no processor function is found at all.

BAD:
```ts
new Worker(QUEUES.EMAIL, async (job) => {
  const { to, subject } = job.data; // no validation
});
```
GOOD:
```ts
new Worker(QUEUES.EMAIL, async (job) => {
  const payload = SendEmailPayloadSchema.parse(job.data); // validates on receipt
  await sendEmail(payload.to, payload.subject);
});
```

### JW004 — idempotency-checked
Skips (passes) if `spec.idempotencyKey` is not set.

When `spec.idempotencyKey` exists, at least one idempotency pattern must appear in the source:
- `job.id` — using the BullMQ/Bull job ID as dedup key
- `idempotency` (case-insensitive) — any reference
- `dedup` (case-insensitive)
- `alreadyProcessed` / `isProcessed`
- `seen.has(` / `seen.get(`
- `redis.get/exists(... job` — Redis lookup with job reference
- `.findUnique(... idempotency` — DB lookup by idempotency key

BAD: `spec.idempotencyKey` is set but code processes jobs without any dedup check.
GOOD:
```ts
const seen = await redis.get(`processed:${job.id}`);
if (seen) return; // already processed — skip
await redis.set(`processed:${job.id}`, "1", { EX: 86400 });
```

### JW005 — errors-typed
Passes with skip if no throw statements are found at all.

**Fails** when: `throw new Error(...)` exists in source AND neither `UnrecoverableError`/`NonRetryableError`/`PermanentError`/`job.discard()` NOR typed custom error classes (`throw new SomeNamedError(`) are present.

**Passes** when: `UnrecoverableError` or typed error class throws are found (retryable vs non-retryable distinction established).

Retrying validation errors wastes queue capacity and can cause poisoned job cycles. Non-retryable errors must be marked explicitly.

BAD: `throw new Error("invalid email format")` — BullMQ will retry this up to `attempts` times.
GOOD:
```ts
import { UnrecoverableError } from 'bullmq';
// ...
if (!isValidEmail(payload.to)) {
  throw new UnrecoverableError(`Invalid email: ${payload.to}`); // stops retries
}
```

### JW006 — no-uncaught-rejection
Inside the processor function (identified by `async (job)` or `async function process`), any async call matching patterns like `*Async(`, `send(`, `emit(`, `publish(`, `enqueue(` that does **not** have `await` on the same line and does **not** have `.catch(` is flagged as a potential uncaught rejection.

Unawaited async calls inside a BullMQ processor swallow errors silently — the job appears to succeed even when the underlying operation fails.

BAD:
```ts
new Worker(QUEUES.EMAIL, async (job) => {
  emailService.sendAsync(job.data.to, job.data.subject); // not awaited
});
```
GOOD:
```ts
new Worker(QUEUES.EMAIL, async (job) => {
  await emailService.sendAsync(job.data.to, job.data.subject);
});
```

### JW007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### JW008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### JW009 — contract-job-worker
Reads `job-worker-artifact.json` (compiler-generated). Required fields: `ir_id`, `jobName`, `queueName`, `concurrency`, `attestation`.

- `ir_id` must start with `JOB_WORKER:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `job-worker-spec.json` missing (JW001 hard-fails)
- `concurrency` not a positive number (JW001)
- No processor function found in source (JW003)
- `job.data.*` accessed without `spec.payloadSchema.parse/validate` in the 30 lines before (JW003)
- `spec.idempotencyKey` declared but no dedup check in code (JW004)
- Only `throw new Error(...)` with no `UnrecoverableError` or typed error classes (JW005)
- Unawaited async calls inside the processor function (JW006)
- No test files (JW008 hard-fails)
