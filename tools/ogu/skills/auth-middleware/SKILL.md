---
name: auth-middleware
description: Compiler skill for the auth-middleware compiler. Activates when producing auth-artifact.json. Gates: AM001–AM011. No upstream dependency. Downstream: api-route (cross-auth gate).
---

# auth-middleware — Compiler Skill

## What This Compiler Does

Compiles authentication middleware. Enforces that the auth strategy is declared in a spec, required functions and error classes are all exported, secrets come only from environment variables, token expiry is always verified, timing-safe comparisons are used for secret-based strategies, and token values never appear in logs or error messages.

**Upstream dependency:** none
**Output artifact:** `auth-artifact.json` (consumed by `api-route` cross-auth gate)
**IR identifiers:** `AUTH:requireAuth`, `AUTH:optionalAuth`, `AUTH:signToken`, `AUTH:verifyToken`, `AUTH:refreshToken`
**Files you create:** `auth-spec.json`, `middleware.ts`, `token.ts`, `errors.ts`, `types.ts`, test file(s)

---

## Files You Must Create

| File | Purpose |
|---|---|
| `auth-spec.json` | Declares strategy, token shape, expiry policy, refresh flag |
| `middleware.ts` | Exports `requireAuth` and `optionalAuth` |
| `token.ts` | Exports `signToken` and `verifyToken` |
| `errors.ts` | Exports all 4 typed error classes |
| `types.ts` | Type definitions (optional but scanned for TODOs) |
| `middleware.test.ts` | At least one test file must exist |

---

## Spec Shape

```json
{
  "strategy": "jwt",
  "tokenShape": {
    "sub": "userId",
    "email": "string",
    "role": "string"
  },
  "expiry": {
    "accessToken": "15m",
    "refreshToken": "7d"
  },
  "refresh": true
}
```

Valid `strategy` values: `jwt` | `session` | `api-key` | `oauth2` | `basic`

`expiry` must be an object with at least `accessToken` — a duration string (e.g. `"15m"`, `"1h"`, `"7d"`).

`refresh` must be `true`, `false`, or an object with a `refreshToken` duration.

---

## Gates

### AM001 — spec-valid
Reads `auth-spec.json`. **Hard-fails** if file is missing — no skip.

Required fields: `strategy`, `tokenShape`, `expiry`, `refresh`.

`strategy` must be one of: `jwt`, `session`, `api-key`, `oauth2`, `basic`.

`expiry` must be an object with at least `accessToken` property set to a duration string.

BAD: `"strategy": "bearer"` — not in enum (use `jwt` or `api-key`). `"expiry": "15m"` — must be an object. `"refresh": "later"` — must be boolean or object.
GOOD: `"strategy": "jwt"`, `"expiry": { "accessToken": "15m", "refreshToken": "7d" }`, `"refresh": true`.

### AM002 — exports-valid
Checks three files against required exports:

| File | Required exports |
|---|---|
| `middleware.ts` | `requireAuth`, `optionalAuth` |
| `token.ts` | `signToken`, `verifyToken` |
| `errors.ts` or `middleware.ts` | `AuthError`, `TokenExpiredError`, `InvalidTokenError`, `MissingTokenError` |

Any named export form is accepted: `export function`, `export const`, `export class`, or `export { name }`.

BAD: `middleware.ts` exports `authenticate` instead of `requireAuth`. `errors.ts` missing `MissingTokenError`.
GOOD: All files present, all names exported exactly as listed.

### AM003 — no-hardcoded-secrets
Checks `middleware.ts`, `token.ts`, `errors.ts`.

Blocked patterns:
- `jwt.sign(payload, "mySecret")` — string literal as JWT secret in sign/verify call
- `secret: "abc123..."` — variable assignment with secret/password/apiKey/token name
- Common weak strings: `"secret"`, `"mysecret"`, `"changeme"`, `"supersecret"`, `"your-secret"`

Lines using these are safe and not flagged: `process.env.JWT_SECRET`, `getSecret(...)`, `secretBroker(...)`, `vault.get(...)`, `config.get(...)`.

BAD: `const token = jwt.sign(payload, "my-hard-coded-secret")`.
BAD: `const JWT_SECRET = "supersecretvalue"`.
GOOD: `const token = jwt.sign(payload, process.env.JWT_SECRET)`.

### AM004 — expiry-checked
Checks `token.ts` and `middleware.ts`.

**Three violations detected:**

1. `jwt.decode()` used without any `jwt.verify()` call — `decode` skips signature verification and ignores expiry.
2. `jwt.verify()` called with `{ ignoreExpiration: true }` — expiry must always be enforced.
3. For non-JWT strategies (session, api-key, basic, oauth2): no manual expiry check found. Must check `.exp`, compare with `Date.now()`, or reference `expiresAt`/`expires_at`.

BAD: `const payload = jwt.decode(token)` — never call decode alone.
BAD: `jwt.verify(token, secret, { ignoreExpiration: true })`.
GOOD: `const payload = jwt.verify(token, process.env.JWT_SECRET)` — verify always checks expiry.

### AM005 — no-todos
Checks `middleware.ts`, `token.ts`, `errors.ts`, `types.ts`.

Blocked markers: `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`, `XXX` (case-insensitive).

### AM006 — error-typed
All four typed error classes must be **defined** (not just imported) in `errors.ts` or `middleware.ts`:

```ts
class AuthError extends Error { ... }
class TokenExpiredError extends AuthError { ... }
class InvalidTokenError extends AuthError { ... }
class MissingTokenError extends AuthError { ... }
```

`AuthError` must `extend Error`. Subclasses should extend `AuthError`.

`throw new Error(...)` within auth-related code (surrounding lines reference `token`, `auth`, `credential`, `permission`, `unauthorized`, `forbidden`) is blocked — use the typed classes instead.

BAD:
```ts
if (!token) throw new Error("Missing token"); // should be MissingTokenError
if (expired) throw new Error("Token expired"); // should be TokenExpiredError
```
GOOD:
```ts
if (!token) throw new MissingTokenError("Authorization header missing");
if (expired) throw new TokenExpiredError("Access token has expired");
```

### AM007 — tests-pass
Finds all `*.test.ts`, `*.spec.ts`, etc. in the auth-middleware directory.

**Hard-fails** if no test files are found. Tests must cover at minimum: valid token, expired token, malformed token, missing token (ideally also: refresh flow, rate limit hit).

All tests must pass via vitest.

### AM008 — coverage
Coverage threshold: **85%** (higher than the 80% standard — auth is a critical security path).

Skips if no test files, vitest not installed, or coverage data unavailable. When coverage data exists, anything below 85% fails.

BAD: `coverage: 78% < 85%`.
GOOD: `coverage: 91% ≥ 85%`.

### AM009 — timing-safe
**Only required for `api-key` and `basic` strategies.** JWT strategies pass this gate automatically.

For `api-key`/`basic`: must use `crypto.timingSafeEqual`, `timingSafeEqual`, `safeCompare`, or `constantTimeEqual` for any secret/key comparison.

All strategies: `===` or `==` comparisons on variables named `apiKey`, `key`, `secret`, or `token` are blocked.

BAD:
```ts
if (apiKey === storedKey) { ... }          // timing attack vector
if (key == process.env.API_KEY) { ... }   // == also blocked
```
GOOD:
```ts
import { timingSafeEqual } from "crypto";
const a = Buffer.from(apiKey);
const b = Buffer.from(process.env.API_KEY!);
if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InvalidTokenError("Bad key");
```

### AM010 — no-secret-leak
Checks `middleware.ts`, `token.ts`, `errors.ts`.

Blocked: token or secret values passed to `console.*` or a `logger.*` call, or interpolated directly into error message strings.

Safe (not flagged): `typeof token`, `token === undefined`, `!token`, `token ?` — these reference the token's presence, not its value.

BAD:
```ts
console.log("Token:", token);                      // raw token in log
throw new AuthError(`Invalid token: ${token}`);   // token value in error message
```
GOOD:
```ts
console.log("Token validation failed — missing token");
throw new MissingTokenError("Authorization header is absent");
```

### AM011 — contract-auth
Validates the final implementation contract against `middleware.ts` and `token.ts`.

| Rule | Requirement |
|---|---|
| require-auth-signature | `requireAuth` exported as async function from `middleware.ts` |
| optional-auth-signature | `optionalAuth` exported as async function from `middleware.ts` |
| bearer-extraction | `Authorization` header parsed with `Bearer` prefix extraction |
| verify-not-decode | `jwt.decode()` never used without `jwt.verify()` |
| error-classes | All 4 typed error classes defined |
| env-secrets | No JWT secret hardcoded in `jwt.sign()`/`jwt.verify()` |

BAD: `middleware.ts` extracts token from `req.headers.token` instead of `Authorization`. `requireAuth` is not async.
GOOD: Bearer extraction reads `req.headers.authorization`, splits on `"Bearer "`, and verifies with `jwt.verify(token, process.env.JWT_SECRET)`.

---

## What This Compiler Never Forgives

- `auth-spec.json` missing (AM001 hard-fails — no skip)
- `jwt.decode()` used alone without `jwt.verify()` — silently accepts expired and tampered tokens
- `ignoreExpiration: true` in verify options
- Any secret, password, or JWT signing key hardcoded as a string literal
- Typed error classes (`AuthError`, etc.) missing — generic `Error` in auth context is rejected
- Token or secret value logged or interpolated into error messages
- `===` comparison on API key or secret values without `timingSafeEqual` (api-key/basic strategies)
- No test files at all (AM007 hard-fails)
- Coverage below **85%** — this compiler's bar is higher than standard (80%)
