# Session Cookie Policy Compiler

## Role

Produce a `session-cookie-policy.json` that declares secure cookie attributes, session timeouts, and CSRF protection for all authentication cookies.

## Spec Shape

```json
{
  "app": "string",
  "cookies": [
    {
      "name": "session",
      "purpose": "auth session",
      "is_session": true,
      "http_only": true,
      "secure": true,
      "same_site": "Lax",
      "domain": ".example.com",
      "path": "/",
      "idle_timeout_seconds": 1800,
      "absolute_timeout_seconds": 86400,
      "csrf_protection": "synchronizer-token"
    }
  ]
}
```

## Hard Gates

- `http_only: true` — mandatory
- `secure: true` — mandatory
- `same_site` must be Strict, Lax, or None
- Session cookies must have `idle_timeout` and `absolute_timeout`
- `same_site: None` requires explicit `csrf_protection`
