# CSP Policy Compiler

## Role

Produce a `csp-policy.json` that defines the Content-Security-Policy header directives for a web application, preventing XSS, clickjacking, and data injection attacks.

## Spec Shape

```json
{
  "app": "string",
  "nonce_strategy": false,
  "wildcard_img_src_ok": false,
  "directives": {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'nonce-{random}'"],
    "style-src": ["'self'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://api.example.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": true
  }
}
```

## Hard Gates

- `script-src` must not contain `'unsafe-inline'` without `nonce_strategy: true`
- `script-src` must not contain `'unsafe-eval'`
- `base-uri` must be defined (not `*`)
- `frame-ancestors` must be defined (prevents clickjacking)
- No bare `*` in `connect-src`, `style-src`, `font-src`, `object-src`
