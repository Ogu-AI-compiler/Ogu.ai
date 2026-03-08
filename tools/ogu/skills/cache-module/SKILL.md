---
name: cache-module
description: Compiler skill for the cache-module compiler. Activates when producing cache-artifact.json. Gates: CA001–CA010. Upstream: optionally cache-topology-artifact.json.
---

# cache-module — Compiler Skill

## What This Compiler Does

Compiles a cache access layer for a single cache family. Enforces that keys are built using a declared key-builder function, TTL values come from config (not inline literals), cache misses always propagate to the origin, write-back is never attempted after an origin read failure, and cache invalidations only target namespaces declared in the spec.

**Upstream dependency:** optionally `cache-topology-artifact.json`
**Output artifact:** `cache-artifact.json`
**IR identifier:** `CACHE:{namespace}`

---

## Spec Shape

```json
{
  "family": "users",
  "namespace": "users:v1",
  "keyInputs": ["userId"],
  "pattern": "read-through",
  "topologyArtifact": "../cache-topology/cache-topology-artifact.json",
  "invalidates": ["sessions:v1"]
}
```

Valid `pattern` values: `read-through` | `write-through` | `cache-aside`

`topologyArtifact` is optional — a relative path to the compiled topology artifact.
`invalidates` is optional — array of additional namespaces this module is allowed to invalidate.

---

## Gates

### CA001 — spec-valid
Reads `cache-spec.json`. Fails if missing.

Required fields: `family` (string), `namespace` (string), `keyInputs` (non-empty array of strings), `pattern`.

`pattern` must be `read-through`, `write-through`, or `cache-aside`.

BAD: `"pattern": "lazy"` — not in enum. `"keyInputs": []` — must have at least one key component.
GOOD: `"keyInputs": ["userId", "resourceType"]`, `"pattern": "read-through"`.

### CA002 — cross-topology
Skips (passes) if `topologyArtifact` is not in the spec.

When declared: the artifact file must exist and be valid JSON. `spec.namespace` must match one of the `namespace` values in `topology.families[]`.

BAD: Topology artifact path points to a non-existent file. Spec declares `"namespace": "users:v2"` but topology only has `"users:v1"`.
GOOD: Topology compiled first; spec namespace matches exactly.

FIX: Run `cache-topology-module` compiler first, then reference its output artifact in `topologyArtifact`.

### CA003 — key-builder-matches-spec
A key-builder function must exist in the source files (non-test `.ts`/`.mjs`/`.js`). Recognized names: `buildKey`, `makeKey`, `cacheKey`, `getKey`, or any function with `Key` in the name.

All identifiers declared in `spec.keyInputs` must appear in the source code.

BAD: `keyInputs: ["userId", "resourceId"]` but the code only references `userId`.
BAD: No function named with `Key` found anywhere.
GOOD:
```ts
function buildKey({ userId, resourceId }: { userId: string; resourceId: string }) {
  return `users:v1:${userId}:${resourceId}`;
}
```

### CA004 — no-inline-ttl
TTL values must come from a variable, config reference, or named constant — not from an inline numeric literal.

**Blocked patterns** (≥2-digit number literal):
- `redis.set(key, val, { EX: 3600 })` — literal in options
- `redis.setEx(key, 86400, val)` — literal as second argument
- `client.expire(key, 900)` — literal in expire call

**Allowed:**
- `redis.set(key, val, { EX: ttl })` — variable
- `redis.set(key, val, { EX: config.ttl })` — config reference
- `redis.set(key, val, { EX: TTL_SECONDS })` — UPPER_CASE named constant

**Escape hatch:** Add `// @inline-ttl-ok: <reason>` on the same line.

BAD: `await redis.setEx(cacheKey, 3600, JSON.stringify(user));`
GOOD: `await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(user));`

### CA005 — miss-propagates
At each `cache.get` / `redis.get` / `client.get` call site, the gate examines the next 30 lines. A violation occurs when:
- There is a `return null`, `return undefined`, `return false`, `return ""`, or `return ''`
- AND there is no origin call (`findOne`, `findMany`, `findById`, `findUnique`, `find`, `query`, `fetch`, `get`, `select`) in those same 30 lines

Each call site is evaluated independently — a file with both a correct and a silent-miss site produces a violation for the silent one.

BAD:
```ts
const cached = await cache.get(key);
if (!cached) return null;  // silent miss — origin never called
```
GOOD:
```ts
const cached = await cache.get(key);
if (cached) return JSON.parse(cached);
const fresh = await db.findUnique({ where: { id: userId } });  // origin fallback
await cache.set(key, JSON.stringify(fresh), { EX: TTL_SECONDS });
return fresh;
```

### CA006 — no-writeback-on-failure
`cache.set` / `redis.set` / `client.setEx` / `client.hSet` / `client.mSet` inside `catch { }` blocks is forbidden.

Writing to cache inside a catch block caches the error/null value and propagates the failure to all future callers.

**Escape hatch:** Add `// @writeback-ok: <reason>` on the same line as the cache.set call (for intentional negative caching).

BAD:
```ts
try {
  const data = await db.find(id);
  await cache.set(key, data);
} catch (e) {
  await cache.set(key, null);  // caches the failure
  throw e;
}
```
GOOD:
```ts
try {
  const data = await db.find(id);
  await cache.set(key, JSON.stringify(data));
} catch (e) {
  // Do NOT write to cache on failure — let the next caller retry the origin
  throw e;
}
```

### CA007 — invalidation-scoped
Any `cache.del` / `redis.del` / `cache.unlink` / `cache.delete` / `cache.flush` / `cache.invalidate` call with a literal string key argument must target only:
- `spec.namespace` (the module's own namespace), OR
- One of the namespaces listed in `spec.invalidates[]`

The key is matched by prefix — `"users:v1:123"` is allowed if `"users:v1"` is in the allowed set.

BAD: `await cache.del("sessions:v2:abc")` — `"sessions:v2"` not declared in `invalidates`.
GOOD: Add `"invalidates": ["sessions:v2"]` to spec, or only invalidate within your own namespace.

### CA008 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files (excluding test files, `node_modules`, `dist`, `.git`).

Blocked markers: `TODO`, `FIXME`, `HACK`.

### CA009 — tests-pass
Finds all `*.test.ts`, `*.spec.ts`, etc. **Hard-fails** if no test files found. Tries vitest first, then jest. Fails if neither is installed.

### CA010 — contract-cache
Reads `cache-artifact.json` (compiler-generated). Required fields: `ir_id` (must start with `CACHE:`), `family`, `namespace`, `pattern`, `keyInputs`, `attestation.hash`.

`artifact.namespace` must match `spec.namespace`.

---

## What This Compiler Never Forgives

- `cache-spec.json` missing (CA001 hard-fails)
- Cache miss returning `null` without calling the origin (CA005)
- `cache.set` inside a `catch` block without `// @writeback-ok:` escape (CA006)
- TTL literal numbers inline (use a variable or `// @inline-ttl-ok:`)
- Invalidating a namespace not declared in `spec.invalidates[]`
- Key builder function missing, or `keyInputs` not all used in the code
