---
name: scheduled-job-module
description: Compiler skill for the scheduled-job-module compiler. Activates when producing scheduled-job-artifact.json. Gates: SJ001–SJ008. No upstream dependency.
---

# scheduled-job-module — Compiler Skill

## What This Compiler Does

Compiles a cron or scheduled job. Enforces that the cron expression is valid, the job registration ID is a stable constant (not randomly generated), a distributed lock guards against multi-node double-execution, and errors in the job body are caught and logged — never propagated to crash the scheduler process.

**Upstream dependency:** none
**Output artifact:** `scheduled-job-artifact.json`
**IR identifier:** `SCHEDULED_JOB:{jobId}`

---

## Spec Shape

```json
{
  "jobId": "daily-report-sync",
  "cronExpression": "0 2 * * *",
  "timezone": "UTC",
  "description": "Syncs daily report data from external CRM at 2am UTC",
  "singleNode": false
}
```

`jobId` must be kebab-case: `^[a-z][a-z0-9-_]+$`

`timezone` is required — prevents silent mistakes from implicit server timezone.

`singleNode: true` is the explicit opt-out from the distributed lock requirement (SJ004). Use only for deployments where a single scheduler node is guaranteed.

---

## Gates

### SJ001 — spec-valid
Reads `scheduled-job-spec.json`. Fails if missing or invalid JSON.

Required fields: `jobId` (kebab-case string), `cronExpression`, `timezone`, `description`.

BAD: `"jobId": "DailyReport"` — uppercase rejected. `"jobId": "daily report"` — spaces rejected. Missing `timezone`.
GOOD:
```json
{
  "jobId": "daily-report-sync",
  "cronExpression": "0 2 * * *",
  "timezone": "UTC",
  "description": "Daily CRM sync"
}
```

### SJ002 — cron-valid
Validates the `cronExpression` field using a built-in field-by-field range parser. Accepts 5-field (standard) or 6-field (with seconds) format.

**5-field format**: `minute hour day-of-month month day-of-week`
- minute: 0–59
- hour: 0–23
- day-of-month: 1–31
- month: 1–12
- day-of-week: 0–7

**6-field format**: `second minute hour day-of-month month day-of-week`
- second: 0–59 (first field)

Supported syntax per field:
- `*` / `?` — any value
- `*/5` — step
- `1-5` — range
- `1,5` — list
- `0-59/5` — step over range

BAD: `"cronExpression": "60 * * * *"` — minute 60 out of range. `"0 * * *"` — only 4 fields.
GOOD: `"0 2 * * *"` (2am daily), `"0 */6 * * *"` (every 6 hours), `"30 4 1,15 * *"` (1st and 15th at 4:30am).

### SJ003 — stable-registration-id
Detects job scheduler registration calls in non-test source files:
- `scheduler.add(`, `cron.schedule(`, `agenda.define(`, `schedule.every(`, `agenda.create(`, `bull.add(`

Within 5 lines around each registration call, checks for dynamic ID patterns:
- `Date.now()` — different on every restart, scheduler may create duplicate jobs
- `Math.random()` / `uuid()` / `nanoid()` / `crypto.randomUUID()` / `new Date()`

BAD:
```ts
scheduler.add(`job-${Date.now()}`, '0 2 * * *', handler); // different ID every restart
```
GOOD:
```ts
const JOB_ID = 'daily-report-sync'; // stable constant from spec
scheduler.add(JOB_ID, '0 2 * * *', handler);
```

### SJ004 — distributed-lock
Fails if no distributed lock pattern is found in the codebase, unless `spec.singleNode: true` is set.

Accepted lock patterns:
- `redlock` / `Redlock` — Redlock algorithm
- `redis.set(... NX` / `redis.setnx(... lock` — Redis native SETNX lock
- `acquireLock` / `releaseLock` / `withLock` — generic lock helpers
- `pg_advisory_lock` / `advisory_lock` — PostgreSQL advisory lock
- `agenda` — Agenda has built-in distributed locking
- `BullMQ` / `bullmq` — BullMQ repeat jobs have built-in dedup

BAD: Using bare `node-cron` with no locking — two deployed instances will both run the job.

GOOD:
```ts
const lock = await redlock.acquire([`lock:${JOB_ID}`], 30_000);
try {
  await runDailySync();
} finally {
  await lock.release();
}
```

OR set `"singleNode": true` in spec (only for guaranteed single-instance deployments).

### SJ005 — errors-non-fatal
Detects job handler functions from patterns: `scheduler.add/schedule/define/every/create/job(...async(`, `async (job)`, `async() =>`.

If a handler is found, `try/catch` must also be present in the source files. Uncaught throws from a cron handler crash the Node.js process.

BAD:
```ts
cron.schedule('0 2 * * *', async () => {
  await runDailySync(); // if this throws, process crashes
});
```
GOOD:
```ts
cron.schedule('0 2 * * *', async () => {
  try {
    await runDailySync();
  } catch (err) {
    logger.error({ err, job: JOB_ID }, 'Scheduled job failed');
    // do NOT rethrow — scheduler must keep running
  }
});
```

### SJ006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### SJ007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### SJ008 — contract-scheduled-job
Reads the compiler-generated `scheduled-job-artifact.json`. Required fields: `ir_id`, `jobId`, `cronExpression`, `timezone`, `attestation`.

- `ir_id` must start with `SCHEDULED_JOB:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `scheduled-job-spec.json` missing (SJ001 hard-fails)
- `jobId` not kebab-case (SJ001)
- Missing `timezone` or `description` (SJ001)
- Invalid cron expression — out-of-range field values, wrong number of fields (SJ002)
- Dynamic ID (`Date.now()`, `uuid()`) near a scheduler registration call (SJ003)
- No distributed lock with multi-node deployment (`singleNode` not set to true) (SJ004)
- Job handler without `try/catch` — errors will crash the scheduler (SJ005)
- No test files (SJ007 hard-fails)
