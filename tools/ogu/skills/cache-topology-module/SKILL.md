---
name: cache-topology-module
description: Compiler skill for the cache-topology-module compiler. Activates when producing cache-topology-artifact.json. Gates: CT001–CT008. No upstream dependency. Downstream: cache-module (cross-topology gate).
---

# cache-topology-module — Compiler Skill

## What This Compiler Does

Compiles the project-wide cache keyspace registry. Enforces that every cache family has a unique namespace (lowercase with hyphens/colons), an explicit TTL or documented no-expiry policy, a serializer, no duplicate key builders for the same resource, and deterministic key-building functions.

**Upstream dependency:** none
**Output artifact:** `cache-topology-artifact.json` (consumed by `cache-module` cross-topology gate)
**IR identifier:** `CACHE_TOPOLOGY`

---

## Spec Shape

```json
{
  "families": [
    {
      "name": "user-profile",
      "namespace": "users:v1",
      "resource": "User",
      "keyInputs": ["userId"],
      "ttl": 300,
      "serializer": "json"
    },
    {
      "name": "session-tokens",
      "namespace": "sessions:v1",
      "resource": "Session",
      "keyInputs": ["sessionId"],
      "noExpiry": true,
      "noExpiryReason": "Sessions expire via explicit delete on logout — TTL would cause silent logouts",
      "serializer": "json"
    }
  ]
}
```

---

## Gates

### CT001 — spec-valid
Reads `cache-topology-spec.json`. Fails if missing.

Required: `families` (non-empty array). Each family entry must have: `name`, `namespace`, `resource`.

BAD: `"families": []` — must have at least one. Family missing `resource` — required to identify the source of truth entity.
GOOD: All families have `name`, `namespace`, `resource`.

### CT002 — namespaces-valid
Each `namespace` must:
1. Match the pattern `^[a-z][a-z0-9:-]*$` — lowercase, starting with a letter, hyphens and colons allowed (e.g. `"users:v1"`, `"order-items"`)
2. Be unique across all families

BAD: `"namespace": "Users:v1"` — uppercase not allowed. `"namespace": "users:v1"` used by two different families — duplicate.
GOOD: `"namespace": "users:v1"` — all lowercase, unique.

### CT003 — ttl-declared
Every family must declare EITHER `ttl` (positive number, in seconds) OR `noExpiry: true`. Both together is also an error. Implicit no-TTL (omitting both) is rejected.

Additional rules:
- `ttl: 0` is rejected — use `noExpiry: true` if intentional
- `noExpiry: true` requires `noExpiryReason` (non-empty string explaining why)

BAD:
- Family with no `ttl` and no `noExpiry` — silently never expires
- `"ttl": 0` — ambiguous
- `"noExpiry": true` with no `noExpiryReason`

GOOD:
```json
{ "ttl": 300 }
```
or:
```json
{ "noExpiry": true, "noExpiryReason": "Invalidated explicitly on logout — no TTL needed" }
```

### CT004 — no-duplicate-keys
Two families cannot cache the same `resource` with the same set of `keyInputs` (order-insensitive). This would cause cache inconsistency where invalidation in one family doesn't apply to the other.

Also re-checks namespace uniqueness as a belt-and-suspenders check.

BAD: Two families both caching `User` with `keyInputs: ["userId"]` — same resource, same key → duplicate.
GOOD: If two families cache `User`, they must use different `keyInputs` (e.g. one by `userId`, one by `email`).

### CT005 — key-builders-deterministic
Scans cache files in: `src/lib/cache/`, `lib/cache/`, `src/cache/` — specifically files with `keys`, `policy`, or `cache` in the filename.

**Skips** if those directories don't exist yet.

Non-deterministic patterns blocked in key-building context:
- `Date.now()`
- `new Date()`
- `Math.random()`
- `crypto.randomUUID()`
- `randomBytes`
- `process.pid`
- `performance.now()`

BAD:
```ts
function buildKey(userId: string) {
  return `user:${userId}:${Date.now()}`; // non-deterministic — different each call
}
```
GOOD:
```ts
function buildKey(userId: string) {
  return `users:v1:${userId}`; // pure function of input only
}
```

### CT006 — no-todos
Recursively scans all `.ts`/`.mjs`/`.js` files. Blocked: `TODO`, `FIXME`, `HACK`.

### CT007 — tests-pass
Finds `*.test.ts` / `*.spec.ts` files. Hard-fails if none found. Tries vitest then jest.

### CT008 — contract-cache-topology
Three contract rules validated against `cache-topology-spec.json`:

| Rule | Check |
|---|---|
| CTR-001 | All families have a `namespace` declared |
| CTR-002 | All families have `ttl` or `noExpiry` declared |
| CTR-003 | All families have a `serializer` declared |

The `serializer` field is required by the contract even if spec-valid (CT001) doesn't hard-require it. Common values: `"json"`, `"msgpack"`, `"string"`.

BAD: A family missing `serializer` passes CT001 but fails CT008.
GOOD: Every family has `"serializer": "json"` or similar.

---

## What This Compiler Never Forgives

- `cache-topology-spec.json` missing (CT001 hard-fails)
- Namespace not lowercase or containing invalid characters
- Duplicate namespaces
- Family with no TTL and no `noExpiry: true`
- `noExpiry: true` without a `noExpiryReason`
- Two families caching the same resource with the same key inputs
- Non-deterministic calls (`Date.now()`, `Math.random()`, etc.) in key-building functions
- Any family missing `serializer` (contract CT008 checks this even if spec-valid doesn't)
