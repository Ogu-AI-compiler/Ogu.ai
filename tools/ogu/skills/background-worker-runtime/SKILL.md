---
name: background-worker-runtime
description: Compiler skill for the background_worker_runtime compiler. Activates when producing bg-worker-artifact.json. Gates: BW001–BW008. No upstream dependency.
---

# background-worker-runtime — Compiler Skill

## What This Compiler Does

Compiles the background worker runtime specification — image, queue bindings, autoscaling, port exposure rules, graceful termination, and dead-letter configuration. Enforces: no mutable image tags (:latest/dev/main/master), every queue has a connection env var, autoscaling min ≤ max, no ports exposed without explicit override, termination grace period 30–600 seconds, and dead-letter queue declared for retry resilience.

**Upstream dependency:** none
**Output artifact:** `bg-worker-artifact.json`
**IR identifier:** `BACKGROUND_WORKER:{project}`

---

## Spec Shape

```json
{
  "name": "email-processor",
  "image": "registry.example.com/email-processor:1.4.2",
  "queues": [
    {
      "name": "email-outbound",
      "connection": "RABBITMQ_URL",
      "prefetch": 5
    }
  ],
  "autoscaling": {
    "minReplicas": 2,
    "maxReplicas": 10,
    "targetQueueDepth": 100
  },
  "terminationGracePeriodSeconds": 60,
  "deadLetterQueue": {
    "name": "email-outbound-dlq",
    "maxRetries": 3
  },
  "concurrency": 4,
  "owner": "platform-team"
}
```

Required fields:
- `name` — string
- `image` — container image reference
- `queues` — non-empty array, each with `name` and `connection` (env var name)

---

## Gates

### BW001 — spec-valid
Reads `bg-worker-spec.json`. Required: `name`, `image`, `queues` (non-empty array). Each queue needs `name` and `connection`.

Hard-fails if `bg-worker-spec.json` is missing.

### BW002 — image-tag-pinned
Image tag must not be mutable: `:latest`, `:dev`, `:main`, `:master` are all rejected. No tag at all is also rejected (implicit latest).

BAD:
```json
{ "image": "myapp:latest" }
{ "image": "myapp" }
{ "image": "myapp:dev" }
```
GOOD:
```json
{ "image": "registry.example.com/myapp:1.4.2" }
{ "image": "myapp@sha256:abc123..." }
```

### BW003 — queues-have-connection
Every queue in `queues` must declare a `connection` field — the name of the environment variable holding the broker URL. Workers without a declared connection env var cannot connect to their queue at runtime.

BAD:
```json
{ "queues": [{ "name": "jobs" }] }
// missing connection env var
```
GOOD:
```json
{ "queues": [{ "name": "jobs", "connection": "RABBITMQ_URL" }] }
```

### BW004 — autoscaling-bounds-valid
Skipped if `spec.autoscaling` not declared. When declared:
- `minReplicas` must be ≥ 1
- `maxReplicas` must be > `minReplicas`

BAD:
```json
{ "autoscaling": { "minReplicas": 10, "maxReplicas": 2 } }
{ "autoscaling": { "minReplicas": 0, "maxReplicas": 5 } }
```
GOOD:
```json
{ "autoscaling": { "minReplicas": 2, "maxReplicas": 10 } }
```

### BW005 — no-exposed-ports
Background workers must not expose ports unless explicitly overridden with `allowExternalExposure: true`. Workers that expose ports become pseudo-services and bypass the ingress/service layer.

BAD:
```json
{ "ports": [8080] }
// no allowExternalExposure override
```
GOOD:
```json
{}
// no ports field — correct for background workers
```
OR:
```json
{ "ports": [9090], "allowExternalExposure": true }
// prometheus metrics scraping — explicitly allowed
```

### BW006 — termination-grace-period
`terminationGracePeriodSeconds` must be declared and be between 30 and 600. Workers need enough time to finish in-flight jobs before shutdown; >600 seconds means 10+ minutes of blocking deploys.

BAD:
```json
{}                                          // missing — defaults to 30s which may be too short
{ "terminationGracePeriodSeconds": 0 }     // immediate kill — jobs corrupted
{ "terminationGracePeriodSeconds": 3600 }  // 1 hour — blocks deploys
```
GOOD:
```json
{ "terminationGracePeriodSeconds": 60 }
```

### BW007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### BW008 — contract-worker
Final contract checks:
- `deadLetterQueue` must be declared — workers without DLQ silently drop failed jobs
- `owner` must be declared — orphaned workers have no on-call responder
- `maxRetries` must be declared (in `deadLetterQueue` or per-queue)
- `concurrency` must be a positive integer if declared

BAD:
```json
{ "name": "processor", "image": "app:1.0", "queues": [{ "name": "q", "connection": "URL" }] }
// missing deadLetterQueue and owner
```
GOOD:
```json
{
  "deadLetterQueue": { "name": "q-dlq", "maxRetries": 3 },
  "owner": "platform-team"
}
```

---

## What This Compiler Never Forgives

- `bg-worker-spec.json` missing (BW001 hard-fails)
- `name`, `image`, or `queues` missing (BW001)
- Any queue missing `connection` field (BW003)
- Image tag is `:latest`, `:dev`, `:main`, `:master`, or missing (BW002)
- `autoscaling.minReplicas` ≥ `maxReplicas` (BW004)
- `autoscaling.minReplicas` < 1 (BW004)
- Ports declared without `allowExternalExposure: true` (BW005)
- `terminationGracePeriodSeconds` missing (BW006)
- `terminationGracePeriodSeconds` < 30 or > 600 (BW006)
- `deadLetterQueue` not declared (BW008)
- `owner` not declared (BW008)
