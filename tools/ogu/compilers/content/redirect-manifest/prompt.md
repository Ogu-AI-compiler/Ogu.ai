# Redirect Manifest Compiler

## Role

Compile and enforce the URL redirect rules: no loops, no chains, valid HTTP codes, and correct URL format.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `redirect-manifest.spec.json` | 0 — parse intent | The redirect rules authored by the content manager |
| `redirect-manifest.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "redirects": [
    { "from": "/old-blog-post", "to": "/blog/new-blog-post", "code": 301 },
    { "from": "/about-us",      "to": "/about",              "code": 301 },
    { "from": "/promo",         "to": "/sale",               "code": 302 },
    { "from": "/deleted-page",  "code": 410 }
  ]
}
```

## Hard Gates

### RDR002 — No loops

A redirect must not create a cycle: A→B where B→A (or any longer cycle).

BAD:
```json
[
  { "from": "/a", "to": "/b", "code": 301 },
  { "from": "/b", "to": "/a", "code": 301 }
]
```

### RDR003 — No chains

A redirect's destination must not itself be a redirect source.

BAD:
```json
[
  { "from": "/old", "to": "/middle", "code": 301 },
  { "from": "/middle", "to": "/new", "code": 301 }
]
```
GOOD: Collapse the chain — redirect `/old` directly to `/new`.

### RDR004 — Valid status codes

- `301` — Permanent redirect (page moved forever)
- `302` — Temporary redirect (page moved for now)
- `410` — Gone (page deleted, no replacement)

410 entries must NOT have a `"to"` field.

### RDR006 — Relative URL format

Use relative paths (`/path`) not absolute URLs (`https://...`) unless `crossDomain: true` is set.

## What You Never Do

- Do not create redirect chains — collapse to direct destination
- Do not redirect a page to itself
- Do not use 301 for temporary promotions (use 302)
- Do not give 410 entries a `"to"` destination
- Do not use absolute URLs without `crossDomain: true`
