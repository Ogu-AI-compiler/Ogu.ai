# Job Producer Module Compiler

## Purpose
Compiles a typed job enqueue module. Every job enqueue must: validate payload, use queue name from topology, await the result, and source options from spec.

## Invariants

1. **Payload validated** — Call `schema.parse(payload)` before `queue.add()`. Never enqueue unvalidated data.
2. **Queue name from topology** — Import queue name constants from the topology module. Never `new Queue('my-queue')`.
3. **Await enqueue** — `await queue.add(...)`. Un-awaited = silent failure.
4. **Options from spec** — `attempts`, `delay`, `priority` from config, not inline literals.

## Standard Pattern

```typescript
import { Queue } from 'bullmq';
import { QUEUES } from '@/queue-topology';
import { emailJobSchema, type EmailJobPayload } from './email-job.schema';
import { config } from '@/config';

const queue = new Queue(QUEUES.EMAIL_SEND, { connection: config.redis });

export async function enqueueEmailJob(payload: EmailJobPayload): Promise<void> {
  const validated = emailJobSchema.parse(payload); // validate before enqueue
  await queue.add('send-email', validated, {       // awaited — no fire-and-forget
    attempts: config.jobs.email.attempts,           // from config — not inline
    backoff: { type: 'exponential', delay: 1000 },
  });
}
```

## spec format (`job-producer-spec.json`)
```json
{
  "jobName": "send-email",
  "queueName": "email-send",
  "payloadSchema": "emailJobSchema",
  "options": { "attempts": 3, "delay": 0, "priority": 1 },
  "topologyArtifact": "../../queue-topology/queue-topology-artifact.json"
}
```

## Error codes

| Code  | Meaning                                            |
|-------|----------------------------------------------------|
| JP001 | job-producer-spec.json missing or invalid          |
| JP002 | queue-topology-artifact referenced but not found   |
| JP003 | Payload not validated before enqueue               |
| JP004 | Queue name hardcoded as string literal             |
| JP005 | Enqueue not awaited (fire-and-forget)              |
| JP006 | Job options not sourced from spec/config           |
| JP007 | TODO/FIXME/HACK comment found                      |
| JP008 | Tests failed                                       |
| JP009 | Job producer contract violation                    |
