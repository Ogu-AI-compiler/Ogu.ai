---
name: seo-metadata-spec
description: Compiler skill for the seo-metadata-spec compiler. Activates when producing seo-metadata-artifact.json. Gates: SMS001–SMS007 + no-todos. Hard-fails when spec missing.
---

# seo-metadata-spec — Compiler Skill

## What This Compiler Does

Compiles SEO metadata specifications per content type — validates spec structure (content types array), requires title templates per type, enforces title length limits (50–60 characters), enforces meta description length limits (120–155 characters), validates OG image minimum dimensions (≥1200×630px), requires explicit robots directive declarations, and validates hreflang coverage for all locales in multi-locale sites.

**Upstream dependency:** none
**Output artifact:** `seo-metadata-artifact.json`
**IR identifier:** `SEO_METADATA_SPEC:{project}`

---

## Spec Shape

**`seo-metadata-spec.spec.json`**:
```json
{
  "locales": ["en", "fr", "de"],
  "contentTypes": [
    {
      "typeId": "blogPost",
      "titleTemplate": "{title} | Acme Blog",
      "titleMaxLength": 60,
      "metaDescriptionMaxLength": 155,
      "ogImage": {
        "minWidth": 1200,
        "minHeight": 630
      },
      "robotsDirective": "index,follow",
      "localized": true,
      "hreflang": {
        "en": "/en/blog/{slug}",
        "fr": "/fr/blog/{slug}",
        "de": "/de/blog/{slug}"
      }
    },
    {
      "typeId": "adminPage",
      "titleTemplate": "{title} — Admin",
      "titleMaxLength": 60,
      "metaDescriptionMaxLength": 155,
      "ogImage": { "minWidth": 1200, "minHeight": 630 },
      "robotsDirective": "noindex,nofollow"
    }
  ]
}
```

Required fields:
- `contentTypes` — non-empty array, each with `typeId`

---

## Gates

### SMS001 — spec-valid
Reads `seo-metadata-spec.spec.json`. Hard-fails if missing. Required: `contentTypes` non-empty array, each entry with `typeId` string.

BAD: spec missing or `contentTypes: []` or any entry without `typeId`.
GOOD: all content type entries have a `typeId`.

### SMS002 — title-template-defined
Every content type must define a `titleTemplate` string. The template controls how the `<title>` tag is generated for each content type.

BAD:
```json
{ "typeId": "product" }
// titleTemplate absent — title generation undefined
```
GOOD:
```json
{ "typeId": "product", "titleTemplate": "{productName} | Acme Store" }
```

### SMS003 — title-length-valid
Every content type must declare `titleMaxLength` as a number between 50 and 60 (inclusive). Search engines truncate titles at ~60 characters; titles under 50 characters leave valuable space unused.

BAD:
```json
{ "typeId": "article", "titleMaxLength": 80 }
// 80 > 60 — titles will be truncated in SERPs
{ "typeId": "article" }
// titleMaxLength absent
```
GOOD:
```json
{ "typeId": "article", "titleMaxLength": 60 }
```

### SMS004 — meta-desc-length-valid
Every content type must declare `metaDescriptionMaxLength` as a number between 120 and 155 (inclusive). Google displays up to ~155 characters; under 120 wastes description space.

BAD:
```json
{ "typeId": "product", "metaDescriptionMaxLength": 200 }
// 200 > 155 — meta description will be truncated in SERPs
```
GOOD:
```json
{ "typeId": "product", "metaDescriptionMaxLength": 155 }
```

### SMS005 — og-image-dimensions
Every content type must declare `ogImage` with `minWidth ≥ 1200` and `minHeight ≥ 630`. Images below these dimensions are rejected or displayed poorly by social platforms.

BAD:
```json
{ "typeId": "post", "ogImage": { "minWidth": 800, "minHeight": 400 } }
// Below minimum — Facebook/Twitter/LinkedIn may reject or downscale
{ "typeId": "post" }
// ogImage not declared
```
GOOD:
```json
{ "typeId": "post", "ogImage": { "minWidth": 1200, "minHeight": 630 } }
```

### SMS006 — robots-directive-declared
Every content type must declare `robotsDirective`. Valid values: `"index,follow"`, `"index,nofollow"`, `"noindex,follow"`, `"noindex,nofollow"`. Absence means the robots directive defaults to browser/crawler defaults — typically `index,follow`, which may be wrong for admin or internal pages.

BAD:
```json
{ "typeId": "adminDashboard" }
// No robotsDirective — admin pages may be indexed by search engines
```
GOOD:
```json
{ "typeId": "adminDashboard", "robotsDirective": "noindex,nofollow" }
{ "typeId": "blogPost",       "robotsDirective": "index,follow" }
```

### SMS007 — hreflang-coverage
When `spec.locales` declares more than one locale, content types with `localized: true` must declare `hreflang` covering all declared locales. Missing hreflang annotations cause duplicate content issues and incorrect locale targeting in search results. Skips if `spec.locales` has ≤1 locale.

BAD (with `locales: ["en", "fr", "de"]`):
```json
{
  "typeId": "article",
  "localized": true,
  "hreflang": { "en": "/en/articles/{slug}", "fr": "/fr/articles/{slug}" }
}
// Missing "de" locale — German searchers get wrong locale
```
GOOD:
```json
{
  "typeId": "article",
  "localized": true,
  "hreflang": {
    "en": "/en/articles/{slug}",
    "fr": "/fr/articles/{slug}",
    "de": "/de/articles/{slug}"
  }
}
```

### SMS008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `seo-metadata-spec.spec.json` missing (SMS001 hard-fails)
- `contentTypes` array empty or missing (SMS001)
- Any entry missing `typeId` (SMS001)
- Any content type missing `titleTemplate` (SMS002)
- `titleMaxLength` not declared or outside 50–60 (SMS003)
- `metaDescriptionMaxLength` not declared or outside 120–155 (SMS004)
- `ogImage` not declared or `minWidth < 1200` or `minHeight < 630` (SMS005)
- `robotsDirective` not declared or not a valid value (SMS006)
- Localized content type missing `hreflang` for any declared locale (SMS007)
- TODO/FIXME/HACK/XXX anywhere (SMS008)
