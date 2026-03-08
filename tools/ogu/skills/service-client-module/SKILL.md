---
name: service-client-module
description: Compiler skill for the service-client-module compiler. Activates when producing service-client-artifact.json. Gates: SC001–SC011. Upstream: optionally client-runtime-artifact.json.
---

# service-client-module — Compiler Skill

## What This Compiler Does

Compiles a typed HTTP service client for a single upstream provider. Enforces that the base URL comes from config (not hardcoded), auth is injected via interceptor (not per-call), all responses are typed domain objects, errors are mapped to typed classes, and at least one resilience strategy is declared (retry, circuit breaker, or timeout). Retry without timeout also fails.

**Upstream dependency:** optionally `client-runtime-artifact.json`
**Output artifact:** `service-client-artifact.json`
**IR identifier:** `SERVICE_CLIENT:{provider}`

---

## Spec Shape

```json
{
  "provider": "stripe",
  "baseUrlConfigKey": "STRIPE_API_BASE_URL",
  "auth": {
    "type": "bearer",
    "headerKey": "Authorization"
  },
  "timeoutMs": 5000,
  "retry": { "maxAttempts": 3 },
  "clientRuntimeArtifact": "../stripe-runtime/client-runtime-artifact.json",
  "endpoints": [
    { "name": "createPayment",  "method": "POST", "path": "/v1/payment_intents", "returns": "PaymentIntent" },
    { "name": "getPayment",     "method": "GET",  "path": "/v1/payment_intents/:id", "returns": "PaymentIntent" }
  ]
}
```

Valid `auth.type` values: `bearer` | `apiKey` | `basic` | `none`

`auth.headerKey` is required when `auth.type` is `bearer` or `apiKey`.

`clientRuntimeArtifact` is optional — a relative path to the compiled runtime artifact.

Resilience fields (`timeoutMs`, `retry`, `circuitBreaker`) can be declared in spec or implemented in code — both are checked.

---

## Gates

### SC001 — spec-valid
Reads `service-client-spec.json`. Fails if missing or invalid JSON.

Required fields: `provider` (string), `baseUrlConfigKey` (string), `auth` (object with valid `type`), `endpoints` (non-empty array).

Each endpoint must have: `name`, `method` (GET|POST|PUT|PATCH|DELETE), `path`, `returns`.

BAD: Missing `returns` on an endpoint. `"auth.type": "jwt"` — not in enum. `"endpoints": []` — empty array.
GOOD:
```json
{
  "provider": "stripe",
  "baseUrlConfigKey": "STRIPE_API_BASE_URL",
  "auth": { "type": "bearer", "headerKey": "Authorization" },
  "endpoints": [
    { "name": "createPayment", "method": "POST", "path": "/v1/payment_intents", "returns": "PaymentIntent" }
  ]
}
```

### SC002 — cross-runtime
Skips if `clientRuntimeArtifact` is not set in the spec.

When set: the artifact must exist and be valid JSON. If `artifact.knownConfigKeys` is non-empty, `spec.baseUrlConfigKey` must be in that list.

BAD: `clientRuntimeArtifact` points to a file with `knownConfigKeys: ["STRIPE_API_URL"]` but spec uses `"baseUrlConfigKey": "STRIPE_BASE_URL"`.
FIX: Compile `service-client-runtime-module` first, then ensure `baseUrlConfigKey` matches a key in that runtime's declaration.

### SC003 — base-url-from-config
Scans all non-test source files for hardcoded `https://` or `http://` URL string literals.

**Exempted** (allowed to appear as literals): `localhost`, `127.0.0.1`, `0.0.0.0`, `example.com`, `test.`, `mock.`

BAD:
```ts
const client = axios.create({ baseURL: 'https://api.stripe.com' }); // hardcoded
```
GOOD:
```ts
const client = axios.create({ baseURL: config.get(STRIPE_API_BASE_URL) }); // from config
```

### SC004 — auth-via-interceptor
Skips if `spec.auth.type === 'none'`.

The gate counts how many non-comment source lines contain inline auth header injection:
- Pattern: `headers: { Authorization:` / `headers: { X-Api-Key:` etc.

Also checks for interceptor patterns: `.interceptors.request.use`, `ky.extend`, `got.extend`, `new Headers(`, `createAuthHeaders`, `withAuth`, `addAuthHeader`, `authInterceptor`, `injectAuth`.

**Fails** when: more than 1 call site sets auth headers inline AND no interceptor/factory is present.
**Fails** when: no auth injection at all is found anywhere (for non-`none` auth types).

BAD:
```ts
// In every method — per-call injection:
async getUser(id: string) {
  return axios.get(`/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}
async createUser(dto) {
  return axios.post('/users', dto, { headers: { Authorization: `Bearer ${token}` } }); // repeated
}
```
GOOD:
```ts
// Once, in client setup:
axiosInstance.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});
```

### SC005 — typed-responses
Scans all non-test `.ts` source files. Blocked:
- `Promise<any>` or `Promise<unknown>` as method return type
- `) as any` — cast to any after a call
- `JSON.parse(...)` at end of line without a type annotation

BAD:
```ts
async getPayment(id: string): Promise<any> {  // blocked
  return axios.get(`/payment_intents/${id}`);
}
```
GOOD:
```ts
async getPayment(id: string): Promise<PaymentIntent> {
  const res = await axios.get<PaymentIntent>(`/payment_intents/${id}`);
  return PaymentIntentSchema.parse(res.data); // validated and typed
}
```

### SC006 — error-mapped
Skips if no HTTP call (`fetch`, `axios`, `got`, `ky`) is found in source files.

When HTTP calls exist: a typed error class (matching `class FooError extends Error` or `class FooException/Failure/Problem extends Error`) or typed throws (`throw new StripeApiError(`) must be present.

Generic `throw new Error(` with no typed error class anywhere = fail.

BAD:
```ts
if (!res.ok) throw new Error(`HTTP ${res.status}`); // not typed
```
GOOD:
```ts
class StripeApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
// ...
if (!res.ok) throw new StripeApiError(res.status, data.code, data.message);
```

### SC007 — resilience-declared
Checks both spec fields and code patterns. At least one resilience strategy must be present:

| Strategy | Spec field | Code patterns |
|---|---|---|
| Retry | `spec.retry` | `p-retry`, `pRetry`, `axiosRetry`, `retryPolicy`, `maxRetries`, `retries:` |
| Circuit breaker | `spec.circuitBreaker` | `opossum`, `CircuitBreaker`, `cockatiel` |
| Timeout | `spec.timeoutMs` | `AbortSignal.timeout`, `AbortController`, `timeout: <number>` |

**Critical**: if retry is declared but no timeout is found → fail. Retry without timeout can hang indefinitely when the upstream never responds.

BAD:
```ts
// Retry with no timeout — will hang if upstream is unresponsive
await pRetry(() => axios.get(url), { retries: 3 }); // missing signal or timeout
```
GOOD:
```ts
await pRetry(
  () => axios.get(url, { signal: AbortSignal.timeout(5000) }),
  { retries: 3 }
);
```

### SC008 — no-sensitive-logging
Scans all source files for log statements (`console.*`, `logger.*`, `log.*`, `winston.*`, `pino.*`).

If a log statement line contains sensitive field names (`password`, `secret`, `token`, `apiKey`, `api_key`, `Authorization`, `credential`, `private_key`), the line must also contain a redaction indicator: `[REDACTED]`, `redact`, `mask(`, `scrub(`, `***`, `'xxxx'`.

BAD:
```ts
logger.debug({ headers: { Authorization: token } }, 'Request sent'); // leaks token
```
GOOD:
```ts
logger.debug({ headers: { Authorization: '[REDACTED]' } }, 'Request sent');
```

### SC009 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### SC010 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### SC011 — contract-service-client
Reads the compiler-generated `service-client-artifact.json`. Required fields: `ir_id`, `provider`, `endpoints[]`, `auth`, `attestation`.

- `ir_id` must start with `SERVICE_CLIENT:`
- `endpoints[]` must be non-empty
- `attestation.hash` must be present
- Every endpoint declared in `spec.endpoints` must appear in `artifact.endpoints`

---

## What This Compiler Never Forgives

- `service-client-spec.json` missing (SC001 hard-fails)
- `auth.type` not in `bearer` | `apiKey` | `basic` | `none` (SC001)
- `auth.headerKey` missing when `auth.type` is `bearer` or `apiKey` (SC001)
- Endpoint missing `name`, `method`, `path`, or `returns` (SC001)
- `clientRuntimeArtifact` declared but artifact not found (SC002)
- `baseUrlConfigKey` not in runtime's `knownConfigKeys` (SC002)
- Hardcoded `https://real-api.com` URL string literal in source (SC003)
- Auth header set inline in >1 call site without interceptor (SC004)
- No auth injection found for non-`none` auth type (SC004)
- `Promise<any>` or `Promise<unknown>` return type (SC005)
- HTTP calls with only generic `throw new Error(` and no typed error class (SC006)
- No resilience strategy (retry, circuit-breaker, or timeout) declared (SC007)
- Retry declared without any timeout mechanism (SC007)
- Sensitive field (`password`, `token`, `secret`) in log statement without redaction (SC008)
- No test files (SC010 hard-fails)
- Spec endpoint not present in compiled artifact (SC011)
