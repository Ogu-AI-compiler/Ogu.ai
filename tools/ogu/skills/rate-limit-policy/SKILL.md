---
name: rate-limit-policy
description: Compiler skill for the rate-limit-policy compiler. Activates when producing rate-limit-policy.json. Gates: RL001–RL006. Upstream: authz-policy.compiled.json.
---

# rate-limit-policy — Compiler Skill

## What This Compiler Does

Compiles rate limiting configuration for all API endpoints in a feature. Enforces that public endpoints have limits, auth endpoints are strictly limited (≤ 20 rpm), burst and sustained rates are both defined, and 429 responses will include the `Retry-After` header.

**Upstream dependency:** `authz-policy.compiled.json`
**Output artifact:** `rate-limit-policy.compiled.json`
**Spec file you write:** `rate-limit-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-api",
  "retry_after_header": true,
  "endpoints": [
    {
      "path": "/api/v1/users",
      "method": "GET",
      "sensitivity": "standard",
      "per_ip_rpm": 300,
      "burst": 50,
      "sustained": 200
    },
    {
      "path": "/api/v1/auth/login",
      "method": "POST",
      "sensitivity": "auth",
      "per_ip_rpm": 10,
      "burst": 5,
      "sustained": 10
    },
    {
      "path": "/api/v1/auth/password/reset",
      "method": "POST",
      "sensitivity": "auth",
      "per_ip_rpm": 3,
      "burst": 2,
      "sustained": 3
    }
  ]
}
```

---

## Gates

### RL001 — spec-valid
Reads `rate-limit-policy.json`. Skips (pass) if file absent.

Required top-level fields: `feature` (string), `endpoints` (non-empty array).

Required per-endpoint fields: `path`, `method`, `sensitivity`.

### RL002 — public-endpoints-have-limits
Every endpoint that is not flagged `"authenticated_only": true` must declare a rate limit via one of: `per_ip_rpm`, `rpm`, or `requests_per_minute`.

BAD: `{ "path": "/api/v1/search", "method": "GET", "sensitivity": "standard" }` — no rate limit field.
GOOD: add `"per_ip_rpm": 200`.

### RL003 — auth-endpoints-stricter
Endpoints matching auth path patterns (`/login`, `/signin`, `/sign-in`, `/auth`, `/token`, `/password/reset`, `/forgot-password`, `/otp`, `/verify`) or with `"sensitivity": "auth"` must:

1. Have an explicit rate limit declared (`per_ip_rpm`, `rpm`, or `requests_per_minute`).
2. Not exceed **20 rpm** if they are login/password/OTP endpoints.
3. Have a lower rpm than the minimum rpm among standard GET endpoints in the spec (when standard endpoints exist).

BAD: `/auth/login` with `per_ip_rpm: 100` → too permissive (> 20 rpm).
BAD: `/auth/login` with no rate limit field at all.
GOOD: `/auth/login` with `per_ip_rpm: 10`.

### RL004 — burst-and-sustained-defined
Every endpoint must define both `burst` and `sustained`, OR the spec must have a top-level `default_limits: { burst: N, sustained: N }` covering all endpoints without explicit values.

BAD: `{ "per_ip_rpm": 300 }` with no `burst` or `sustained`.
GOOD: `{ "per_ip_rpm": 300, "burst": 50, "sustained": 200 }`.

### RL005 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `rate-limit-policy.json`.

### RL006 — retry-after-header-defined
The spec must set `"retry_after_header": true` at the top level. This declares that 429 responses include the `Retry-After` header so clients can implement correct backoff.

BAD: no `retry_after_header` field in the spec.
GOOD: `"retry_after_header": true`.

---

## What This Compiler Never Forgives

- Auth endpoints (login, token, password reset) with `per_ip_rpm > 20`
- Auth endpoints with no rate limit declared
- Any endpoint missing both `burst` and `sustained` (with no top-level default)
- Missing `retry_after_header: true`
