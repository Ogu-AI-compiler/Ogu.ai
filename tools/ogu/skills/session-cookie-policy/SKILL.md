---
name: session-cookie-policy
description: Compiler skill for the session-cookie-policy compiler. Activates when producing session-cookie-policy.json. Gates: SK001–SK006. Upstream: authz-policy.compiled.json.
---

# session-cookie-policy — Compiler Skill

## What This Compiler Does

Compiles session and cookie security configuration. Enforces that HttpOnly and Secure flags are set, both idle and absolute expiry are defined, a CSRF mechanism is declared, and session tokens rotate on login to prevent session fixation.

**Upstream dependency:** `authz-policy.compiled.json`
**Output artifact:** `session-cookie-policy.compiled.json`
**Spec file you write:** `session-cookie-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-auth",
  "cookie": {
    "name": "session",
    "http_only": true,
    "secure": true,
    "same_site": "Strict",
    "max_age_seconds": 3600,
    "absolute_expiry_seconds": 86400
  },
  "session": {
    "rotate_on_login": true,
    "idle_timeout_seconds": 3600,
    "absolute_timeout_seconds": 86400
  },
  "csrf": {
    "mechanism": "synchronizer-token",
    "token_rotation": true
  }
}
```

---

## Gates

### SK001 — spec-valid
Reads `session-cookie-policy.json`. Skips (pass) if file absent.

Required top-level fields: `cookie` (object), `csrf` (object), `session` (object).

### SK002 — secure-flags-set
`cookie.http_only` must be `true` AND `cookie.secure` must be `true`. Both are required.

BAD: `"http_only": false` — cookie readable by JavaScript, XSS steals session.
BAD: `"secure": false` — cookie transmitted over HTTP, MITM can steal it.
GOOD: both `true`.

### SK003 — expiration-defined
Both `cookie.max_age_seconds` (idle timeout) and `cookie.absolute_expiry_seconds` (hard session ceiling) must be positive numbers.

BAD: only `max_age_seconds` defined — session can live forever if user stays active.
GOOD: both fields present and positive.

### SK004 — csrf-protection-declared
`csrf.mechanism` must be one of: `samesite-strict`, `double-submit-cookie`, `synchronizer-token`. Any of the three passes.

BAD: `"csrf": {}` — no mechanism.
BAD: `"csrf": { "mechanism": "none" }`.
GOOD: `"csrf": { "mechanism": "synchronizer-token" }`.

### SK005 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `session-cookie-policy.json`.

### SK006 — token-rotation-on-auth
`session.rotate_on_login` must be `true`. Session fixation: an attacker who fixes a victim's session token before login will retain access after the victim authenticates, unless the token is rotated on login.

BAD: `"session": { "rotate_on_login": false }`.
GOOD: `"session": { "rotate_on_login": true }`.

---

## What This Compiler Never Forgives

- `cookie.http_only: false` or `cookie.secure: false`
- Missing `absolute_expiry_seconds` — session can persist indefinitely
- `csrf.mechanism` absent or empty
- `session.rotate_on_login: false` — session fixation attack vector
