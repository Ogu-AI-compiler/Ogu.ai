---
name: job-producer-module
description: Compiler skill for the job-producer-module compiler. Activates when producing job-producer-artifact.json. Gates: JP001–JP009. Upstream: optionally queue-topology-artifact.json.
---

# job-producer-module — Compiler Skill

## What This Compiler Does

Compiles a typed job enqueue module for BullMQ/Bull/pg-boss. Enforces that the job payload is validated against a declared schema before enqueue, the queue name comes from a topology constant (not hardcoded), every enqueue call is awaited (no fire-and-forget), and job options (delay, priority, attempts) come from spec or config (not inline literals).

**Upstream dependency:** optionally `queue-topology-artifact.json`
**Output artifact:** `job-producer-artifact.json`
**IR identifier:** `JOB_PRODUCER:{jobName}`

---

## Spec Shape

```json
{
  "jobName": "send-email",
  "queueName": "email-queue",
  "payloadSchema": "SendEmailPayloadSchema",
  "topologyArtifact": "../queue-topology/queue-topology-artifact.json",
  "options": {
    "attempts": 3,
    "delay": 0,
    "priority": 1
  }
}
```

`topologyArtifact` is optional — a relative path to the compiled topology artifact.
`options` is optional — if present, enables the options-from-spec gate (JP006).

---

## Gates

### JP001 — spec-valid
Reads `job-producer-spec.json`. Fails if missing or invalid JSON.

Required fields: `jobName` (string), `queueName` (string), `payloadSchema` (non-empty string — the name of the Zod/Joi schema variable).

BAD: Missing `payloadSchema`. `"payloadSchema": ""` — must be non-empty. Missing `queueName`.
GOOD: `{ "jobName": "send-email", "queueName": "email-queue", "payloadSchema": "SendEmailPayloadSchema" }`

### JP002 — cross-topology
Skips (passes) if `topologyArtifact` is not set in the spec.

When declared: the artifact file must exist and be valid JSON. `spec.queueName` must be in `topology.queues[].name`.

BAD: Spec declares `"queueName": "email-queue"` but topology only has `["notification-queue"]`.
GOOD: Compile `queue-topology-module` first; ensure `queueName` matches a topology queue name.

FIX: Run `queue-topology-module` compiler first, then reference its output artifact in `topologyArtifact`.

### JP003 — payload-validated
Scans all non-test source files for enqueue calls: `queue.add(`, `bull.add(`, `boss.send(`, `boss.publish(`, `boss.createJob(`.

At each enqueue call site, checks the **20 lines before** that call for a validation call using `spec.payloadSchema`:
- Must contain the schema name (e.g. `SendEmailPayloadSchema`)
- Must contain `.parse(`, `.validate(`, or `.safeParse(`

Also fails if no enqueue call is found at all.

BAD:
```ts
await queue.add('send-email', payload); // no validation before enqueue
```
GOOD:
```ts
const validated = SendEmailPayloadSchema.parse(payload); // validates first
await queue.add('send-email', validated);
```

### JP004 — queue-name-from-topology
The `spec.queueName` string must not appear as a bare string literal in non-comment source lines. The pattern matches the queue name with both hyphen and underscore variants.

The queue name is allowed in constant definition files (the gate is lenient — comment lines are excluded).

BAD: `new Queue('email-queue')` or `await queue.add('email-queue', payload)` in source code.
GOOD:
```ts
// queue-topology.ts (or queues.ts — constant file)
export const QUEUES = { EMAIL: 'email-queue' };

// email.producer.ts
import { QUEUES } from './queue-topology';
new Queue(QUEUES.EMAIL);
```

### JP005 — no-fire-and-forget
Every `queue.add(`, `bull.add(`, `boss.send(`, `boss.publish(`, `boss.createJob(`, `producer.add(` call must have `await` or `return` on the same line.

Unawaited enqueues fail silently — if the queue connection drops, the error is swallowed and the job is never queued.

BAD: `queue.add(QUEUES.EMAIL, validated);` — no await.
GOOD: `await queue.add(QUEUES.EMAIL, validated);` or `return queue.add(QUEUES.EMAIL, validated);`

### JP006 — options-from-spec
Skips (passes) if `spec.options` is not declared.

When `spec.options` exists, checks that no inline numeric literals appear for `attempts`, `delay`, or `priority` without a config/spec reference.

**Blocked** — inline literals without config reference:
- `attempts: 3`
- `delay: 5000`
- `priority: 2`

**Allowed** — when line also contains: `config.`, `options.`, `JOB_OPTIONS`, `QUEUE_OPTIONS`, or `spec.`

BAD: `await queue.add(name, payload, { attempts: 3, delay: 5000 })` — magic numbers inline.
GOOD: `await queue.add(name, payload, { attempts: config.jobs.email.attempts, delay: JOB_OPTIONS.delay })`

### JP007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### JP008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### JP009 — contract-job-producer
Reads `job-producer-artifact.json` (compiler-generated). Required fields: `ir_id`, `jobName`, `queueName`, `payloadSchema`, `attestation`.

- `ir_id` must start with `JOB_PRODUCER:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `job-producer-spec.json` missing (JP001 hard-fails)
- `payloadSchema` not present or empty (JP001)
- No enqueue call found in source at all (JP003)
- Enqueue call without `spec.payloadSchema.parse/validate` in the 20 lines before it (JP003)
- Queue name as string literal in source code (JP004)
- Enqueue without `await` or `return` (JP005)
- `spec.options` declared but inline literals used for `attempts`/`delay`/`priority` (JP006)
- No test files (JP008 hard-fails)
