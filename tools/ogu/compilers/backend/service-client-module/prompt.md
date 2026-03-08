# Service Client Module Compiler

## Purpose
Compiles a typed HTTP client for a single upstream service provider. Every provider gets its own dedicated client module — no generic "httpClient" shared across providers.

## Invariants (non-negotiable)

1. **Base URL from config** — Never hardcode `https://api.provider.com`. Read it from the config module via `baseUrlConfigKey`. This allows per-environment overrides with zero code changes.
2. **Auth via interceptor** — Authorization/X-Api-Key headers belong in an axios interceptor, `ky.extend`, `got.extend`, or a `createAuthHeaders()` factory — not repeated in every request call.
3. **Typed responses** — Every endpoint method returns a typed domain object. No `Promise<any>`, no `as any`, no untyped `JSON.parse`.
4. **Typed errors** — Non-2xx responses are caught and thrown as typed error classes (e.g. `StripeApiError`, `TwilioError`). Callers can `instanceof`-check.
5. **Resilience** — Declare at least timeout. If retry is used, timeout is mandatory (retry without timeout = infinite hang).
6. **No sensitive logging** — Never log Authorization headers, API keys, tokens, or passwords without `[REDACTED]`.

## Standard Pattern (axios)

```typescript
// stripe/stripe.client.ts
import axios, { AxiosInstance } from 'axios';
import { config } from '@/config';
import { StripeApiError } from './stripe.errors';
import type { StripeCharge, StripeCustomer } from './stripe.types';

function createStripeClient(): AxiosInstance {
  const client = axios.create({
    baseURL: config.stripe.baseUrl,   // from config — never hardcoded
    timeout: 10_000,
  });

  // Auth via interceptor — not per-call
  client.interceptors.request.use(req => {
    req.headers.Authorization = `Bearer ${config.stripe.secretKey}`;
    return req;
  });

  // Error mapping interceptor
  client.interceptors.response.use(
    res => res,
    err => {
      const status = err.response?.status ?? 0;
      const message = err.response?.data?.error?.message ?? err.message;
      throw new StripeApiError(status, message);
    }
  );

  return client;
}

const stripeClient = createStripeClient();

export async function chargeCard(amount: number, customerId: string): Promise<StripeCharge> {
  const { data } = await stripeClient.post<StripeCharge>('/charges', { amount, customer: customerId, currency: 'usd' });
  return data;
}

export async function getCustomer(id: string): Promise<StripeCustomer> {
  const { data } = await stripeClient.get<StripeCustomer>(`/customers/${id}`);
  return data;
}
```

## spec format (`service-client-spec.json`)
```json
{
  "provider": "stripe",
  "baseUrlConfigKey": "stripe.baseUrl",
  "auth": { "type": "bearer", "headerKey": "Authorization" },
  "timeoutMs": 10000,
  "retry": { "maxAttempts": 3, "statusCodes": [429, 502, 503, 504] },
  "endpoints": [
    { "name": "chargeCard", "method": "POST", "path": "/charges", "returns": "StripeCharge" },
    { "name": "getCustomer", "method": "GET", "path": "/customers/:id", "returns": "StripeCustomer" }
  ],
  "clientRuntimeArtifact": "../../client-runtime/client-runtime-artifact.json"
}
```

## Error codes

| Code  | Meaning                                                      |
|-------|--------------------------------------------------------------|
| SC001 | service-client-spec.json missing or invalid                  |
| SC002 | client-runtime-artifact referenced but not found             |
| SC003 | Hardcoded base URL in client code                            |
| SC004 | Auth header set per-call instead of via interceptor/factory  |
| SC005 | Response returned as any/unknown — must be typed             |
| SC006 | Non-2xx not mapped to typed error class                      |
| SC007 | No resilience strategy (timeout/retry/circuit-breaker)       |
| SC008 | Sensitive field logged without redaction                     |
| SC009 | TODO/FIXME/HACK comment found                                |
| SC010 | Tests failed                                                 |
| SC011 | Service client contract violation                            |

## What NOT to do

- Do not create one generic HTTP client used by multiple providers. Each provider = one client module.
- Do not log request bodies in production without scrubbing sensitive fields.
- Do not use `fetch` with `retry` from a loop — use a dedicated retry library (p-retry, axios-retry).
- Do not catch errors silently and return `null` — propagate typed errors to the caller.
- Do not hardcode API versions in base URL — put version in the endpoint path or config.
