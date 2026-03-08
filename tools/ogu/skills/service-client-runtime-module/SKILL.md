---
name: service-client-runtime-module
description: Compiler skill for the service-client-runtime-module compiler. Activates when producing client-runtime-artifact.json. Gates: SR001–SR009. Upstream: optionally config-artifact.json.
---

# service-client-runtime-module — Compiler Skill

## What This Compiler Does

Compiles the shared HTTP transport layer used by all service clients. Enforces that every `fetch()` call has a timeout or AbortSignal, base URLs come from config, secret headers are redacted in logs, retry logic targets only explicitly allowlisted conditions (never blanket retries on all errors or 4xx), and non-2xx responses are mapped to typed error classes.

**Upstream dependency:** optionally `config-artifact.json`
**Output artifact:** `client-runtime-artifact.json`
**IR identifier:** `CLIENT_RUNTIME`

---

## Spec Shape

```json
{
  "defaultTimeout": 5000,
  "retryPolicy": {
    "maxRetries": 3,
    "allowedMethods": ["GET", "PUT", "DELETE"],
    "allowedStatuses": [429, 502, 503, 504]
  },
  "secretHeaders": ["Authorization", "X-Api-Key", "X-Internal-Token"]
}
```

`defaultTimeout` — positive number in milliseconds. Required.

`retryPolicy.maxRetries` — number. Set to `0` to disable retry entirely.

`retryPolicy.allowedMethods` and/or `retryPolicy.allowedStatuses` — required when `maxRetries > 0` (contract CR-003).

`secretHeaders` — array of header names to redact in logs. Must be non-empty (contract CR-002). Defaults `Authorization`, `X-Api-Key`, `X-Auth-Token` are always checked regardless.

---

## Gates

### SR001 — spec-valid
Reads `client-runtime-spec.json`. Fails if missing or invalid JSON.

Required fields: `defaultTimeout` (positive number), `retryPolicy` (object with `maxRetries: number`), `secretHeaders` (array).

BAD: `"defaultTimeout": 0` — must be positive. `"retryPolicy": {}` — missing `maxRetries`. Missing `secretHeaders` array.
GOOD:
```json
{
  "defaultTimeout": 5000,
  "retryPolicy": { "maxRetries": 3 },
  "secretHeaders": ["Authorization"]
}
```

### SR002 — timeout-enforced
Looks for HTTP client files in these locations (in order):
1. `src/lib/http/` directory
2. `src/http/`, `lib/http/`, `http/`
3. Fallback: any file with `HttpClient`, `Fetcher`, or `Http` in its name

Hard-fails if no HTTP client files are found at all.

For every `fetch(` call in those files, checks the 3 lines before and 5 lines after for timeout enforcement:
- `AbortSignal` / `AbortController`
- `signal:` option
- `timeout:` / `timeoutMs` / `requestTimeout`

BAD:
```ts
const res = await fetch(url, { method: 'GET', headers }); // no signal — hangs forever
```
GOOD:
```ts
const res = await fetch(url, {
  method: 'GET',
  headers,
  signal: AbortSignal.timeout(this.defaultTimeout), // enforced
});
```

### SR003 — base-url-from-config
Scans HTTP client files (preferring `src/lib/http/`, then searching by filename pattern). Blocked: hardcoded `https://` or `http://` URL string literals.

**Allowed exception**: `localhost` or `127.0.0.1` on lines that also contain `default`, `dev`, or `fallback` (local dev config defaults).

BAD:
```ts
const BASE_URL = 'https://payments.company.internal'; // hardcoded
```
GOOD:
```ts
import { env } from '../config';
const BASE_URL = env.PAYMENTS_SERVICE_URL; // from config
```

### SR004 — secrets-redacted
Scans all non-test source files. Uses `spec.secretHeaders` plus the always-checked defaults: `Authorization`, `X-Api-Key`, `X-Auth-Token`.

When a log statement (`console.*`, `logger.*`, `pino.*`, `winston.*`, `bunyan.*`) on the same line mentions a secret header name, the surrounding context (2 lines before, 3 lines after) must contain a redaction indicator:
- `redact`
- `***` (3+ asterisks)
- `[REDACTED]`
- `[HIDDEN]`
- `.slice(0, N)` (partial reveal)
- `.replace`
- `'***'`

BAD:
```ts
logger.debug({ headers: requestConfig.headers }, 'Making request'); // leaks Authorization
```
GOOD:
```ts
const safeHeaders = { ...headers, Authorization: '[REDACTED]' };
logger.debug({ headers: safeHeaders }, 'Making request');
```

### SR005 — retry-allowlisted
Skips if `spec.retryPolicy.maxRetries === 0` (retry disabled).

When retry is enabled: finds files with `retry` or `HttpClient` in their name. Hard-fails if no retry implementation file is found.

**Blocked** dangerous retry patterns:
- Blanket `catch(e) { retry... }` without status filtering
- Retry on 4xx status codes (`status >= 400 ... retry`)
- POST retry without idempotency key check

**Required** safe retry conditions (at least one):
- `allowedStatuses` / `retryStatuses` / `allowedMethods` / `idempotent`
- `ECONNRESET` / `ETIMEDOUT` / `ENOTFOUND` / `NetworkError`
- Status check for `429` / `502` / `503` / `504`
- `retryCondition` / `shouldRetry`

BAD:
```ts
} catch (err) {
  if (retries > 0) return this.request(opts, retries - 1); // retries everything
}
```
GOOD:
```ts
const shouldRetry = [429, 502, 503, 504].includes(response.status) &&
  ['GET', 'PUT', 'DELETE'].includes(opts.method);
if (shouldRetry && retries > 0) return this.request(opts, retries - 1);
```

### SR006 — errors-typed
Checks `src/lib/http/errors.ts` (or `src/lib/http/error.ts`, `src/http/errors.ts`, `lib/http/errors.ts`) for typed error class definitions.

If no errors file exists, falls back to checking `src/lib/http/httpClient.ts` directly.

Requires:
- A class extending `Error` with a name pattern ending in `Error` or `Exception`
- A status check (`response.ok`, `response.status >= 400`, `!ok`)

BAD: `errors.ts` exists but only exports utility functions, no class.
BAD: `httpClient.ts` checks status but does `throw new Error('HTTP error')` — generic.

GOOD:
```ts
// src/lib/http/errors.ts
export class HttpClientError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

export class ServiceUnavailableError extends HttpClientError {}
```
```ts
// httpClient.ts
if (!response.ok) {
  const body = await response.json().catch(() => null);
  if (response.status === 503) throw new ServiceUnavailableError(503, body);
  throw new HttpClientError(response.status, body);
}
```

### SR007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### SR008 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### SR009 — contract-client-runtime
Validates three contract rules (CR-001 through CR-003) from `client-runtime.contract.json`:

| Rule | Check |
|---|---|
| CR-001 | `spec.defaultTimeout` must be > 0 |
| CR-002 | `spec.secretHeaders` must be non-empty |
| CR-003 | If `retryPolicy.maxRetries > 0`, `retryPolicy` must have `allowedMethods` or `allowedStatuses` |

CR-003 is the key one: you cannot enable retry without declaring what conditions allow it.

---

## What This Compiler Never Forgives

- `client-runtime-spec.json` missing (SR001 hard-fails)
- `defaultTimeout` not a positive number (SR001)
- `retryPolicy.maxRetries` missing (SR001)
- No HTTP client files found at expected locations (SR002 hard-fails)
- `fetch()` without `AbortSignal` / timeout within 3–5 lines (SR002)
- Hardcoded `https://api.real-service.com` URL in HTTP client files (SR003)
- Secret header value logged without redaction in surrounding context (SR004)
- Retry implementation catches all errors without status/method allowlist (SR005)
- Retry file not found when `maxRetries > 0` (SR005)
- No typed error class defined for non-2xx responses (SR006)
- `secretHeaders` empty in spec (SR009 CR-002)
- `retryPolicy.maxRetries > 0` without `allowedMethods` or `allowedStatuses` (SR009 CR-003)
- No test files (SR008 hard-fails)
