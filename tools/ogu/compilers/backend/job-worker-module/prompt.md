# Job Worker Module Compiler

## Purpose
Compiles a BullMQ job worker with proper payload validation, idempotency, and error classification.

## Invariants

1. **Validate on receipt** — `schema.parse(job.data)` before any business logic.
2. **Idempotency** — Check deduplication store before processing if `idempotencyKey` declared.
3. **Classify errors** — `throw new UnrecoverableError(...)` for non-retryable. Generic `throw new Error(...)` = retryable.
4. **Await everything** — All async calls inside processor must be awaited.

## Standard Pattern

```typescript
import { Worker, UnrecoverableError } from 'bullmq';
import { QUEUES } from '@/queue-topology';
import { emailJobSchema } from './email-job.schema';
import { config } from '@/config';

new Worker(QUEUES.EMAIL_SEND, async (job) => {
  // Validate on receipt
  const payload = emailJobSchema.safeParse(job.data);
  if (!payload.success) throw new UnrecoverableError(`Invalid payload: ${payload.error.message}`);

  // Idempotency check
  const alreadyProcessed = await redis.get(`processed:${job.id}`);
  if (alreadyProcessed) return;

  // Process
  await emailService.send(payload.data);
  await redis.set(`processed:${job.id}`, '1', { EX: 86400 });
}, { concurrency: config.workers.email.concurrency, connection: config.redis });
```

## Error codes

| Code  | Meaning                                               |
|-------|-------------------------------------------------------|
| JW001 | job-worker-spec.json missing or invalid               |
| JW002 | Producer artifact mismatch (queue name differs)       |
| JW003 | Payload not validated before processing               |
| JW004 | Idempotency key declared but no dedup check found     |
| JW005 | Errors not classified (UnrecoverableError missing)    |
| JW006 | Unawaited async call in processor                     |
| JW007 | TODO/FIXME/HACK comment                               |
| JW008 | Tests failed                                          |
| JW009 | Job worker contract violation                         |
