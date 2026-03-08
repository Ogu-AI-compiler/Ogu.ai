---
name: rate-limit-policy-module
description: Compiler skill for the rate-limit-policy-module compiler. Activates when producing rate-limit-policy-artifact.json. Gates: RL001–RL007. No upstream dependency.
---

# rate-limit-policy-module — Compiler Skill

## What This Compiler Does

Compiles a rate limit policy. Enforces that the policy has a declared scope, quota, and window; the key builder function is deterministic; 429 responses include a Retry-After header; and any admin/internal bypass of the limit is explicitly declared in the spec.

**Upstream dependency:** none
**Output artifact:** `rate-limit-policy-artifact.json`
**IR identifier:** `RATE_LIMIT_POLICY:{policyId}`

---

## Spec Shape

```json
{
  "policyId": "api-default",
  "scope": "user",
  "quota": 100,
  "windowSeconds": 60,
  "strategy": "sliding",
  "bypassConditions": ["isInternal"]
}
```

Valid `scope` values: `user` | `ip` | `api-key` | `global` | `endpoint`

Valid `strategy` values: `sliding` | `fixed` | `token-bucket` | `leaky-bucket`

`bypassConditions` is optional — list of string identifiers that acknowledge intentional bypasses in the implementation. If code contains bypass patterns without a matching entry in this array, the gate fails.

---

## Gates

### RL001 — spec-valid
Reads `rate-limit-spec.json`. Fails if missing or invalid JSON.

Required fields: `policyId` (string), `scope`, `quota` (positive number), `windowSeconds` (positive number), `strategy`.

BAD: `"quota": 0` — must be ≥1. `"strategy": "leaking"` — not in enum. Missing `windowSeconds`.
GOOD:
```json
{
  "policyId": "api-default",
  "scope": "user",
  "quota": 100,
  "windowSeconds": 60,
  "strategy": "sliding"
}
```

### RL002 — key-deterministic
Finds key builder function declarations in non-test source files. Detected by these patterns in a function definition line:
- Function names containing `Key` (e.g. `buildKey`, `makeKey`, `rateLimitKey`, `getKey`, `keyFor`)
- `function *Key*`

Scans the 30 lines following the function declaration for non-deterministic calls:
- `Date.now()` — changes every millisecond, limit never triggered
- `Math.random()` — different key every call, no limiting possible
- `new Date()` — same problem as Date.now
- `crypto.randomUUID()` / `nanoid()` / `uuid()` — random per call

BAD:
```ts
function buildKey(req) {
  return `rl:${req.ip}:${Date.now()}`; // non-deterministic — resets every millisecond
}
```
GOOD:
```ts
function buildKey(req) {
  return `rl:${req.user?.id ?? req.ip}`;  // deterministic
}
```

### RL003 — retry-after-header
Scans all non-test source files. If any file contains an explicit 429 response (`status(429)`, `sendStatus(429)`, `429,`), then `Retry-After` or `retry_after` must also appear somewhere in the codebase.

If no explicit 429 is found (i.e. rate limiting is handled entirely by middleware), the gate skips — the middleware is assumed to set the header.

BAD:
```ts
res.status(429).json({ error: 'Too many requests' }); // no Retry-After
```
GOOD:
```ts
res.set('Retry-After', Math.ceil(windowSeconds));
res.status(429).json({ error: 'Too many requests' });
```

### RL004 — no-undeclared-bypass
Scans all non-test source files for bypass patterns:
- `isAdmin` / `is_admin` / `role === "admin"` / `req.user.admin`
- `isInternal` / `is_internal` / `x-internal-request`
- `skip: true` / `bypassRateLimit` / `skipRateLimit`
- `whitelist` / `allowlist`

Every bypass pattern found in non-comment code must have a matching string in `spec.bypassConditions[]`.

BAD:
```ts
if (req.user.isAdmin) return next(); // undeclared bypass
```
GOOD — declare the bypass in spec:
```json
{ "bypassConditions": ["isAdmin"] }
```
Then the code is permitted:
```ts
if (req.user.isAdmin) return next(); // declared in bypassConditions
```

### RL005 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### RL006 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### RL007 — contract-rate-limit-policy
Reads the compiler-generated `rate-limit-policy-artifact.json`. Required fields: `ir_id`, `policyId`, `scope`, `quota`, `windowSeconds`, `strategy`, `attestation`.

- `ir_id` must start with `RATE_LIMIT_POLICY:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `rate-limit-spec.json` missing (RL001 hard-fails)
- `scope` not in `user` | `ip` | `api-key` | `global` | `endpoint` (RL001)
- `strategy` not in `sliding` | `fixed` | `token-bucket` | `leaky-bucket` (RL001)
- `quota` or `windowSeconds` not a positive number (RL001)
- Key builder function using `Date.now()`, `Math.random()`, `crypto.randomUUID()` (RL002)
- Explicit 429 response without `Retry-After` header anywhere in code (RL003)
- Bypass pattern (`isAdmin`, `isInternal`, `skip: true`, `whitelist`) without declaration in `spec.bypassConditions` (RL004)
- No test files (RL006 hard-fails)
