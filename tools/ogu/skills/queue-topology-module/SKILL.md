---
name: queue-topology-module
description: Compiler skill for the queue-topology-module compiler. Activates when producing queue-topology-artifact.json. Gates: QT001–QT008. Upstream: optionally config-artifact.json.
---

# queue-topology-module — Compiler Skill

## What This Compiler Does

Compiles the project-wide queue registry. Enforces that all queue names are unique and follow naming conventions, every queue has an explicit retry policy (or explicit opt-out), every queue declares retention limits for completed and failed jobs, and no queue name string literal appears outside the topology module.

**Upstream dependency:** optionally `config-artifact.json`
**Output artifact:** `queue-topology-artifact.json`
**IR identifier:** `QUEUE_TOPOLOGY`

---

## Spec Shape

```json
{
  "queues": [
    {
      "name": "email-notifications",
      "owner": "email-service",
      "retryPolicy": {
        "maxRetries": 3,
        "backoff": "exponential"
      },
      "retention": {
        "completed": 100,
        "failed": 500
      }
    },
    {
      "name": "audit-log",
      "owner": "audit-service",
      "noRetry": true,
      "retention": {
        "completed": 0,
        "failed": 1000
      }
    }
  ]
}
```

Queue name rules: lowercase alphanumeric with hyphens or underscores, must start with a letter (`^[a-z][a-z0-9-_]*$`).

`noRetry: true` is the explicit opt-out from retry — without either `retryPolicy` or `noRetry`, the compiler rejects the queue.

`retention.completed: 0` means immediately remove completed jobs (fire-and-forget style).

---

## Gates

### QT001 — spec-valid
Reads `queue-topology-spec.json`. Fails if missing or invalid JSON.

Required: `queues` — non-empty array.

Each queue entry must have:
- `name` — lowercase alphanumeric with hyphens/underscores, must start with a letter
- `owner` — non-empty string

BAD: `"name": "EmailQueue"` — uppercase letters rejected. `"name": "email queue"` — spaces rejected. Missing `owner`.
GOOD:
```json
{
  "queues": [
    { "name": "email-notifications", "owner": "email-service", ... }
  ]
}
```

### QT002 — unique-names
All queue names in `spec.queues` must be unique.

Queues are global — duplicate names cause silent job routing bugs where jobs from different producers end up in the same queue.

BAD: Two queues both named `"email-notifications"`.
GOOD: Every queue has a distinct name.

### QT003 — retry-declared
Every queue must have EITHER `retryPolicy: { maxRetries: N }` OR `noRetry: true`.

Omitting both is rejected — implicit "no retry" is ambiguous and dangerous.

Additionally: if `retryPolicy.maxRetries > 1` and no `backoff` strategy is declared, the gate also fails. Retrying multiple times without backoff causes thundering herd problems.

BAD:
```json
{ "name": "email-notifications", "owner": "email-service", "retention": {...} }
```
(no retryPolicy and no noRetry — ambiguous)

BAD:
```json
{ "retryPolicy": { "maxRetries": 5 } }
```
(multiple retries without backoff strategy)

GOOD:
```json
{ "retryPolicy": { "maxRetries": 3, "backoff": "exponential" } }
```
or
```json
{ "noRetry": true }
```

### QT004 — retention-declared
Every queue must declare a `retention` object with both `completed` and `failed` fields as non-negative numbers.

Without retention, completed jobs accumulate in the queue backend (Redis/Postgres) indefinitely, causing memory and disk exhaustion.

BAD: No `retention` object at all.
BAD: `retention: { completed: 100 }` — missing `failed`.
BAD: `retention: { completed: -1, failed: 500 }` — negative value rejected.

GOOD:
```json
"retention": {
  "completed": 100,
  "failed": 500
}
```

`completed: 0` means remove completed jobs immediately — valid for fire-and-forget queues.

### QT005 — no-undeclared-queues
Queue name strings must not appear as string literals in any `.ts` source file outside the topology module. The topology module files are: `src/lib/queues`, `lib/queues`, `src/queues`.

Test files (`.test.`, `.spec.`) are exempt — assertions may reference names.
Comment lines are exempt.

The gate builds a regex from all declared queue names and scans all non-exempt `.ts` files.

BAD:
```ts
// In email.producer.ts:
const queue = new Queue('email-notifications', connection); // hardcoded string
```

GOOD:
```ts
// In src/lib/queues.ts (the topology module):
export const QUEUES = { EMAIL_NOTIFICATIONS: 'email-notifications' };

// In email.producer.ts:
import { QUEUES } from '../../lib/queues';
const queue = new Queue(QUEUES.EMAIL_NOTIFICATIONS, connection);
```

### QT006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### QT007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### QT008 — contract-queue-topology
Validates three contract rules (QTR-001 through QTR-003) from `queue-topology.contract.json`:

| Rule | Check |
|---|---|
| QTR-001 | No duplicate queue names |
| QTR-002 | Every queue has `retryPolicy` or `noRetry: true` |
| QTR-003 | Every queue has a `retention` object |

These mirror QT002–QT004 but run as a formal contract check at the end of compilation.

---

## What This Compiler Never Forgives

- `queue-topology-spec.json` missing (QT001 hard-fails)
- `queues` empty array (QT001)
- Queue `name` not lowercase or containing spaces (QT001)
- Queue missing `owner` (QT001)
- Duplicate queue names (QT002)
- Queue with neither `retryPolicy` nor `noRetry: true` (QT003)
- `retryPolicy.maxRetries > 1` without `backoff` strategy (QT003)
- Queue missing `retention` object entirely (QT004)
- `retention.completed` or `retention.failed` absent or negative (QT004)
- Queue name string literal in source files outside the topology module (QT005)
- No test files (QT007 hard-fails)
