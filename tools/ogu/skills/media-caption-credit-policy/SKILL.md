---
name: media-caption-credit-policy
description: Compiler skill for the media-caption-credit-policy compiler. Activates when producing media-caption-artifact.json. Gates: MCP001–MCP007 + no-todos. Hard-fails when spec missing.
---

# media-caption-credit-policy — Compiler Skill

## What This Compiler Does

Compiles media caption and credit policies — validates spec structure (media types array), requires explicit caption and credit declarations per media type, requires credit templates when credits are mandatory, validates template variable usage against declared variables, requires license declarations for externally sourced media, requires attribution placement strategy for credited media, and requires expiry monitoring for time-limited licensed content.

**Upstream dependency:** none
**Output artifact:** `media-caption-artifact.json`
**IR identifier:** `MEDIA_CAPTION_POLICY:{project}`

---

## Spec Shape

**`media-caption-credit-policy.spec.json`**:
```json
{
  "mediaTypes": [
    {
      "type": "editorial-photo",
      "source": "external",
      "captionRequired": true,
      "creditRequired": true,
      "creditTemplate": "Photo: {photographer} / {agency}",
      "attributionPlacement": "inline",
      "licenseRequired": true,
      "timeLimited": true,
      "expiryMonitoring": true
    },
    {
      "type": "product-image",
      "source": "internal",
      "captionRequired": false,
      "creditRequired": false
    }
  ],
  "templateVariables": ["photographer", "agency", "publication", "year"],
  "prohibitedPhrases": []
}
```

Required fields:
- `mediaTypes` — non-empty array, each with `type` string

---

## Gates

### MCP001 — spec-valid
Reads `media-caption-credit-policy.spec.json`. Hard-fails if missing. Required: `mediaTypes` non-empty array, each entry with a `type` string.

BAD: spec missing or `mediaTypes: []` or any entry without `type`.
GOOD: all media type entries have a `type` field.

### MCP002 — caption-credit-declared
Every media type must explicitly declare both `captionRequired` and `creditRequired` as booleans.

BAD:
```json
{ "type": "editorial-photo" }
// captionRequired and creditRequired absent — policy unknown
```
GOOD:
```json
{
  "type": "editorial-photo",
  "captionRequired": true,
  "creditRequired": true
}
```

### MCP003 — credit-template-defined
When `creditRequired: true`, the media type must define a `creditTemplate` string. A non-empty template ensures consistent credit formatting across all content.

BAD:
```json
{ "type": "editorial-photo", "creditRequired": true }
// No creditTemplate — editors must invent credit format manually every time
```
GOOD:
```json
{
  "type": "editorial-photo",
  "creditRequired": true,
  "creditTemplate": "Photo: {photographer} / {agency}"
}
```

### MCP004 — template-vars-valid
Variables used in `creditTemplate` (e.g., `{photographer}`) must be declared in `spec.templateVariables`. Undeclared variables break template rendering at publish time. Skips if `templateVariables` is not declared.

BAD:
```json
{
  "templateVariables": ["photographer", "agency"],
  "mediaTypes": [{
    "type": "wire-photo",
    "creditTemplate": "Photo: {photographer} via {wire_service}"
  }]
}
// {wire_service} not in templateVariables
```
GOOD:
```json
{
  "templateVariables": ["photographer", "agency", "wire_service"],
  "mediaTypes": [{
    "type": "wire-photo",
    "creditTemplate": "Photo: {photographer} via {wire_service}"
  }]
}
```

### MCP005 — license-required-external
Media types with `source: "external"` must declare `licenseRequired: true`. Using external media without license tracking creates copyright liability.

BAD:
```json
{ "type": "stock-photo", "source": "external", "creditRequired": true }
// licenseRequired not declared — external images used without license verification
```
GOOD:
```json
{
  "type": "stock-photo",
  "source": "external",
  "creditRequired": true,
  "licenseRequired": true
}
```

### MCP006 — attribution-placement-declared
Media types with `creditRequired: true` must declare `attributionPlacement`. Valid values: `"inline"` (credit appears with image), `"footer"` (credit in page footer), `"metadata-only"` (credit in hidden metadata only).

BAD:
```json
{ "type": "editorial-photo", "creditRequired": true, "creditTemplate": "Photo: {photographer}" }
// attributionPlacement not declared — credit location undefined
```
GOOD:
```json
{
  "type": "editorial-photo",
  "creditRequired": true,
  "creditTemplate": "Photo: {photographer}",
  "attributionPlacement": "inline"
}
```

### MCP007 — expiry-monitoring-set
Media types with `licenseRequired: true` AND `timeLimited: true` must declare `expiryMonitoring: true`. Time-limited licensed content that expires without monitoring creates immediate copyright liability.

BAD:
```json
{
  "type": "wire-photo",
  "licenseRequired": true,
  "timeLimited": true
}
// expiryMonitoring not declared — expired licensed content silently remains published
```
GOOD:
```json
{
  "type": "wire-photo",
  "licenseRequired": true,
  "timeLimited": true,
  "expiryMonitoring": true
}
```

### MCP008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `media-caption-credit-policy.spec.json` missing (MCP001 hard-fails)
- `mediaTypes` array empty or missing (MCP001)
- Any media type entry missing `type` field (MCP001)
- `captionRequired` or `creditRequired` not declared on any entry (MCP002)
- `creditRequired: true` without `creditTemplate` (MCP003)
- `creditTemplate` using variables not in `templateVariables` (MCP004)
- External media (`source: "external"`) without `licenseRequired: true` (MCP005)
- Credit-required media without `attributionPlacement` declaration (MCP006)
- `attributionPlacement` not one of: inline, footer, metadata-only (MCP006)
- Time-limited licensed media without `expiryMonitoring: true` (MCP007)
- TODO/FIXME/HACK/XXX anywhere (MCP008)
