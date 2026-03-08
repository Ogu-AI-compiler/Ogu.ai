# SEO Metadata Spec Compiler

## Role

Compile and enforce per-content-type SEO rules: title templates, meta description limits, OG image dimensions, robots directives, and hreflang coverage.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `seo-metadata-spec.spec.json` | 0 — parse intent | The SEO rules authored by the content manager |
| `seo-metadata-spec.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "locales": ["en", "fr", "de"],
  "contentTypes": [
    {
      "typeId": "article",
      "titleTemplate": "{title} | {siteName}",
      "titleMaxLength": 60,
      "metaDescriptionMaxLength": 155,
      "ogImage": { "minWidth": 1200, "minHeight": 630 },
      "robotsDirective": "index,follow",
      "localized": true,
      "hreflang": {
        "en": "/en/blog/{slug}",
        "fr": "/fr/blog/{slug}",
        "de": "/de/blog/{slug}"
      }
    },
    {
      "typeId": "landing-page",
      "titleTemplate": "{headline} — {siteName}",
      "titleMaxLength": 55,
      "metaDescriptionMaxLength": 150,
      "ogImage": { "minWidth": 1200, "minHeight": 630 },
      "robotsDirective": "index,follow",
      "localized": false
    }
  ]
}
```

## Hard Gates

### SMS003 — Title length 50–60

`titleMaxLength` must be a number between 50 and 60.

BAD: `"titleMaxLength": 80` or `"titleMaxLength": "long"`
GOOD: `"titleMaxLength": 60`

### SMS005 — OG image ≥ 1200×630

`ogImage.minWidth` ≥ 1200 and `ogImage.minHeight` ≥ 630.

BAD: `{ "minWidth": 800, "minHeight": 400 }`
GOOD: `{ "minWidth": 1200, "minHeight": 630 }`

### SMS006 — Robots directive enum

Only these values are valid:
- `"index,follow"` — standard crawlable page
- `"index,nofollow"` — indexed but links not followed
- `"noindex,follow"` — not indexed, links followed
- `"noindex,nofollow"` — completely excluded

### SMS007 — hreflang all locales

If `localized: true`, then `hreflang` must cover every locale in `spec.locales`.

## What You Never Do

- Do not set titleMaxLength outside 50–60
- Do not set metaDescriptionMaxLength outside 120–155
- Do not use arbitrary robots directive values
- Do not omit ogImage for any content type
- Do not leave hreflang incomplete for localized content types
