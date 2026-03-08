---
name: healthcheck-module
description: Compiler skill for the healthcheck-module compiler. Activates when producing healthcheck-artifact.json. Gates: HC001–HC009. Upstream: optionally config-artifact.json.
---

# healthcheck-module — Compiler Skill

## What This Compiler Does

Compiles liveness and readiness health check handlers. Enforces that liveness never calls remote systems, readiness returns machine-readable per-dependency JSON, every remote dependency has a timeout bound, health checks are read-only, and failures produce deterministic `"unhealthy"` or `"degraded"` status.

**Upstream dependency:** optionally `config-artifact.json`
**Output artifact:** `healthcheck-artifact.json`
**IR identifier:** `HEALTHCHECK`
**Health file locations:** `src/lib/health/readiness.ts`, `src/lib/health/liveness.ts`

---

## Spec Shape

```json
{
  "dependencies": [
    { "name": "postgres",  "type": "database", "timeoutMs": 3000 },
    { "name": "redis",     "type": "redis",    "timeoutMs": 1000 },
    { "name": "stripe-api","type": "http",     "timeoutMs": 5000, "degradedMode": true }
  ],
  "livenessChecks": ["uptime", "processMemory"],
  "readinessChecks": ["postgres", "redis"]
}
```

Valid `dependency.type` values: `database` | `redis` | `http` | `queue` | `storage`

`livenessChecks` and `readinessChecks` are optional arrays of check names.
`degradedMode: true` means a failure returns `"degraded"` instead of `"unhealthy"`.

---

## Gates

### HC001 — spec-valid
Reads `healthcheck-spec.json`. Fails if missing or invalid JSON.

Required field: `dependencies` (array — can be empty but must be present).

Each dependency entry must have:
- `name` (string)
- `type` (one of: `database`, `redis`, `http`, `queue`, `storage`)
- `timeoutMs` (positive number)

BAD: `"type": "postgres"` — not in enum (use `"database"`). `"timeoutMs": 0` — must be positive. Missing `timeoutMs`.
GOOD: `{ "name": "postgres", "type": "database", "timeoutMs": 3000 }`

### HC002 — liveness-no-remote
Liveness checks must be process-local only. They must never call remote systems.

**Two modes of checking:**

1. **Named liveness checks** (`spec.livenessChecks`): Gate checks that none of the names match remote system patterns (`database`, `redis`, `db`, `queue`, `http`), and none of the names match dependency names from `spec.dependencies`.

2. **File-based check** (if no `livenessChecks` in spec): Scans `src/lib/health/liveness.ts` (or `src/health/liveness.ts`, `lib/health/liveness.ts`, `health/liveness.ts`) for remote call patterns: `prisma.`, `db.`, `pool.`, `redis.`, `client.get/set/ping/query`, `fetch(`, `axios.`, `queue.`, `bullmq`, `.query(`, `.ping(`.

The reason: if liveness calls Redis and Redis is down, the container gets killed and restarted — even though the application process itself is healthy.

BAD: `"livenessChecks": ["postgres", "uptime"]` — `postgres` is a remote dependency.
BAD: `liveness.ts` file calls `redis.ping()`.
GOOD: `"livenessChecks": ["uptime", "processMemory"]` — process-local metrics only.
GOOD: Liveness handler returns `{ uptime: process.uptime(), memory: process.memoryUsage() }`.

### HC003 — readiness-machine-readable
Requires `src/lib/health/readiness.ts` to exist (or `src/health/readiness.ts`, `lib/health/readiness.ts`).

**Two checks on the file content:**

1. Machine-readable: file must contain at least one of: `status: "healthy"`, `status: "unhealthy"`, `status: "degraded"`, `dependencies:`, `res.json(`, `reply.send(`, `JSON.stringify`.

2. Per-dependency structure: file must contain one of: dynamic key patterns (`[name]:`, `dependencies[`), iteration (`.forEach(dep`, `reduce(`), or the word `dependencies`.

BAD: Readiness handler just returns `200 OK` text — no per-dependency status.
GOOD:
```ts
res.json({
  status: overallStatus,
  dependencies: {
    postgres: { status: "healthy", latencyMs: 12 },
    redis: { status: "degraded", latencyMs: 450, error: "slow" }
  }
});
```

### HC004 — dependency-timeouts
Skips if no remote dependencies (all types in `spec.dependencies` are remote: `database`, `redis`, `http`, `queue`, `storage`).

When remote dependencies exist, scans health files (`src/lib/health/readiness.ts`, `src/lib/health/liveness.ts`, `src/lib/health/index.ts`) for timeout patterns:
- `Promise.race(`
- `AbortSignal.timeout`
- `setTimeout.*reject`
- `timeoutMs` / `timeout:`
- `withTimeout(`
- `.timeout(`

BAD: `await db.$queryRaw\`SELECT 1\`` in readiness with no timeout — will hang if DB is slow.
GOOD: `await Promise.race([db.$queryRaw\`SELECT 1\`, timeout(dep.timeoutMs)])`

### HC005 — no-destructive-ops
Scans all files with `health`, `liveness`, or `readiness` in the filename (`.ts` files).

Blocked patterns in health check files:
- `INSERT INTO` / `DELETE FROM` / `UPDATE ... SET` / `DROP TABLE` / `TRUNCATE`
- `redis.del(` / `.delete(` / `.set(` / `.hset(` / `.rpush(`
- `prisma.*.create(` / `prisma.*.update(` / `prisma.*.delete(`
- `db.*.insert(`

**Safe exceptions** (these match write patterns but are actually reads/pings):
- `SELECT 1` — safe read query
- `.ping()` — connectivity check only
- `$queryRaw.*SELECT` — raw read query

Health checks must be purely observational.

BAD: `await redis.set('health:check', Date.now())` — writes to Redis in health check.
GOOD: `await redis.ping()` — read-only connectivity check.

### HC006 — deterministic-failure
Reads `src/lib/health/readiness.ts`. Skips if file not found.

**Fails** if an empty catch block exists (`catch (e) { }`) — this silently swallows failures.

**Fails** if no deterministic failure handling pattern is found:
- `status: "unhealthy"` — explicit unhealthy status on failure
- `status: "degraded"` — degraded status
- `catch (...) { ... status` — catch block that produces a status
- `.catch(err =>` — promise catch with error handling

BAD:
```ts
} catch (e) { } // swallowed — caller gets no failure signal
```
GOOD:
```ts
} catch (err) {
  return { status: "unhealthy", error: err.message, latencyMs: Date.now() - start };
}
```

### HC007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### HC008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### HC009 — contract-healthcheck
Validates three contract rules (HC-001 through HC-003):

| Rule | Check |
|---|---|
| HC-001 | All dependencies in spec have `timeoutMs > 0` |
| HC-002 | `spec.dependencies` is non-empty (must declare at least one dependency) |
| HC-003 | `spec.livenessChecks` must not contain remote system names (`database`, `redis`, `db`, `queue`, `http`) |

HC-002 is worth noting: an empty `dependencies` array passes HC001 but fails the contract — the spec must declare at least one dependency to check.

---

## What This Compiler Never Forgives

- `healthcheck-spec.json` missing (HC001 hard-fails)
- Dependency missing `timeoutMs` or `type` (HC001)
- `dependencies` array empty in spec (HC009 HC-002)
- Liveness checking remote systems — `postgres`, `redis`, DB calls in liveness file (HC002)
- Readiness file missing (`src/lib/health/readiness.ts` not found) (HC003)
- No timeout bound for remote dependency checks (HC004)
- Write operations in health files — `INSERT`, `redis.set`, `prisma.*.create` (HC005)
- Empty catch block swallowing health check failures (HC006)
- No `status: "unhealthy"` / `"degraded"` in catch block (HC006)
- No test files (HC008 hard-fails)
