---
name: redirect-manifest
description: Compiler skill for the redirect-manifest compiler. Activates when producing redirect-manifest-artifact.json. Gates: RDR001–RDR006 + no-todos. Hard-fails when spec missing.
---

# redirect-manifest — Compiler Skill

## What This Compiler Does

Compiles redirect manifest files — validates spec structure (redirects array with `from`/`to` pairs), detects redirect loops (A→A or A→B→A cycles), detects redirect chains (A→B→C where the destination is itself redirected), enforces valid HTTP status codes (301, 302, 410 only), blocks self-redirects, and validates URL formats (relative paths required unless cross-domain).

**Upstream dependency:** none
**Output artifact:** `redirect-manifest-artifact.json`
**IR identifier:** `REDIRECT_MANIFEST:{project}`

---

## Spec Shape

**`redirect-manifest.spec.json`**:
```json
{
  "redirects": [
    { "from": "/old-blog",          "to": "/blog",                  "code": 301 },
    { "from": "/product/v1",        "to": "/products/current",      "code": 302 },
    { "from": "/deleted-page",      "code": 410 },
    { "from": "/external-partner",  "to": "https://partner.com",    "code": 301, "crossDomain": true }
  ]
}
```

Required fields:
- `redirects` — array (can be empty, which is treated as "no redirects to validate")
- Each redirect: `from` string, `to` string (except 410 Gone), `code` number

---

## Gates

### RDR001 — spec-valid
Reads `redirect-manifest.spec.json`. Hard-fails if missing. Required: `redirects` array. Each redirect must have `from` and `to` (except `code: 410`). Empty `redirects: []` is allowed (skips remaining gates).

BAD: spec missing or any redirect missing `from` or `to` (unless 410).
GOOD: valid JSON with `redirects` array where each entry has `from` and `to`.

### RDR002 — no-redirect-loops
No circular redirect chains. Detects both self-redirects (A→A) and multi-hop cycles (A→B→A, A→B→C→A).

BAD:
```json
{ "from": "/blog", "to": "/articles", "code": 301 },
{ "from": "/articles", "to": "/blog", "code": 301 }
// A→B→A loop — browsers hit redirect limit and show an error
```
GOOD: No path from any `from` URL eventually leads back to itself.

### RDR003 — no-redirect-chains
The destination (`to`) of a redirect must not itself be a `from` URL in the manifest. Chains cause extra round-trips and can trigger browser redirect limits.

BAD:
```json
{ "from": "/page-v1",  "to": "/page-v2",    "code": 301 },
{ "from": "/page-v2",  "to": "/page-final", "code": 301 }
// Chain: /page-v1 → /page-v2 → /page-final (two hops instead of one)
```
GOOD:
```json
{ "from": "/page-v1",  "to": "/page-final", "code": 301 },
{ "from": "/page-v2",  "to": "/page-final", "code": 301 }
// Both old URLs point directly to the final destination
```

### RDR004 — valid-status-codes
Redirect `code` must be one of: `301` (permanent), `302` (temporary), `410` (gone). 410 Gone entries must not have a `to` destination.

BAD:
```json
{ "from": "/old", "to": "/new", "code": 303 }
// 303 not in allowed set
{ "from": "/deleted", "to": "/archive", "code": 410 }
// 410 Gone must not have a destination
```
GOOD:
```json
{ "from": "/old",     "to": "/new", "code": 301 }
{ "from": "/temp",    "to": "/new", "code": 302 }
{ "from": "/deleted",              "code": 410 }
```

### RDR005 — no-self-redirect
`from` and `to` URLs must be different (normalized, trailing slash ignored).

BAD:
```json
{ "from": "/about",  "to": "/about/",  "code": 301 }
// Same URL after trailing-slash normalization
```
GOOD:
```json
{ "from": "/about",  "to": "/about-us", "code": 301 }
```

### RDR006 — url-format-valid
`from` and `to` URLs must start with `/` (relative paths). Absolute URLs are only allowed when `crossDomain: true` is set on the redirect entry. 410 Gone entries are exempt from `to` validation.

BAD:
```json
{ "from": "old-blog", "to": "/blog", "code": 301 }
// "from" doesn't start with "/" — relative path required
{ "from": "/promo",   "to": "https://partner.com", "code": 302 }
// External URL without crossDomain:true
```
GOOD:
```json
{ "from": "/old-blog", "to": "/blog",             "code": 301 }
{ "from": "/partner",  "to": "https://partner.com", "code": 301, "crossDomain": true }
```

### RDR007 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `redirect-manifest.spec.json` missing (RDR001 hard-fails)
- Any redirect missing `from` (RDR001)
- Any non-410 redirect missing `to` (RDR001)
- Circular redirect loops (A→B→A) (RDR002)
- Redirect chains (destination is also a source) (RDR003)
- Status code not 301, 302, or 410 (RDR004)
- 410 Gone with a `to` destination (RDR004)
- `from` and `to` resolving to the same URL (RDR005)
- URL not starting with "/" without `crossDomain: true` (RDR006)
- TODO/FIXME/HACK/XXX anywhere (RDR007)
