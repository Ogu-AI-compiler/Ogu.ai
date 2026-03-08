---
name: csp-policy
description: Compiler skill for the csp-policy compiler. Activates when producing csp-policy.json. Gates: CP001–CP006. No upstream dependency.
---

# csp-policy — Compiler Skill

## What This Compiler Does

Compiles the Content Security Policy for a frontend application. Enforces that `unsafe-inline` is only used with a nonce/hash, `base-uri` is declared (prevents base-tag injection), `frame-ancestors` is declared (prevents clickjacking), and no directive uses a wildcard source.

**Upstream dependency:** none
**Output artifact:** `csp-policy.compiled.json`
**Spec file you write:** `csp-policy.json`

---

## Spec Shape

```json
{
  "feature": "web-frontend",
  "report_uri": "/api/csp-report",
  "directives": {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'nonce-{NONCE}'"],
    "style-src":  ["'self'"],
    "img-src":    ["'self'", "data:", "https://cdn.example.com"],
    "connect-src":["'self'", "https://api.example.com"],
    "font-src":   ["'self'"],
    "object-src": ["'none'"],
    "base-uri":   ["'self'"],
    "frame-ancestors": ["'none'"]
  }
}
```

---

## Gates

### CP001 — spec-valid
Reads `csp-policy.json`. Skips (pass) if file absent.

Required top-level fields: `directives` (object), `report_uri` (string).

### CP002 — no-unsafe-inline-without-nonce
If `directives["script-src"]` contains `"'unsafe-inline'"`, the same array must also contain a nonce (`"'nonce-"` prefix) or a hash (`"'sha256-"` prefix).

BAD: `"script-src": ["'self'", "'unsafe-inline'"]` — blanket XSS enabler.
GOOD: `"script-src": ["'self'", "'unsafe-inline'", "'nonce-{NONCE}'"]`.
BEST: `"script-src": ["'self'", "'nonce-{NONCE}'"]` — no unsafe-inline at all.

### CP003 — base-uri-defined
`directives["base-uri"]` must be present and non-empty. Without it, an attacker can inject a `<base>` tag and redirect all relative URLs to an attacker-controlled origin.

BAD: no `base-uri` key in `directives`.
GOOD: `"base-uri": ["'self'"]` or `"base-uri": ["'none'"]`.

### CP004 — frame-ancestors-defined
`directives["frame-ancestors"]` must be present and non-empty. Without it, the page can be embedded in any iframe — enabling clickjacking.

BAD: no `frame-ancestors` key in `directives`.
GOOD: `"frame-ancestors": ["'none'"]` (no embedding) or `"frame-ancestors": ["'self'"]`.

### CP005 — no-wildcard-sources
No directive may contain `"*"` as a source value.

BAD: `"img-src": ["*"]`.
GOOD: `"img-src": ["'self'", "https://cdn.example.com"]`.

### CP006 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `csp-policy.json`.

---

## What This Compiler Never Forgives

- `unsafe-inline` in `script-src` without a nonce or hash
- Missing `base-uri` directive
- Missing `frame-ancestors` directive
- Wildcard `*` in any directive source list
