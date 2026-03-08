# Scheduled Job Module Compiler

## Purpose
Compiles a cron/scheduled job with safe execution semantics.

## Invariants

1. **Valid cron** — Expression parsed and validated.
2. **Stable ID** — Job ID is a constant string, never dynamic.
3. **Distributed lock** — Prevents double-execution across multiple nodes.
4. **Non-fatal errors** — Catch all errors; never rethrow from job handler.

## Standard Pattern

```typescript
import Redlock from 'redlock';
import { redis } from '@/infrastructure/redis';

const redlock = new Redlock([redis]);
const JOB_ID = 'daily-digest'; // stable constant

cron.schedule('0 9 * * *', async () => {
  let lock;
  try {
    lock = await redlock.acquire([`lock:${JOB_ID}`], 30_000);
    await digestService.sendDailyDigest();
  } catch (err) {
    logger.error({ jobId: JOB_ID, err }, 'Job failed'); // caught — non-fatal
  } finally {
    await lock?.release();
  }
}, { timezone: 'UTC' });
```

## spec format
```json
{
  "jobId": "daily-digest",
  "cronExpression": "0 9 * * *",
  "timezone": "UTC",
  "description": "Send daily digest email to active users",
  "singleNode": false
}
```

## Error codes

| Code  | Meaning                                         |
|-------|-------------------------------------------------|
| SJ001 | scheduled-job-spec.json missing or invalid      |
| SJ002 | Cron expression invalid                         |
| SJ003 | Job registration ID is dynamic (Date/random)    |
| SJ004 | No distributed lock                             |
| SJ005 | Job error propagates to crash scheduler         |
| SJ006 | TODO/FIXME/HACK comment                         |
| SJ007 | Tests failed                                    |
| SJ008 | Scheduled job contract violation                |
