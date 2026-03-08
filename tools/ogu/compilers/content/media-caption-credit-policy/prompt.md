# Media Caption Credit Policy Compiler

## Role

Compile and enforce attribution rules for all media types: captions, credits, license requirements for external assets, attribution placement, and expiry monitoring for time-limited licenses.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `media-caption-credit-policy.spec.json` | 0 — parse intent | The media governance rules authored by the content manager |
| `media-caption-credit-policy.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "templateVariables": ["photographer", "year", "source", "license"],
  "mediaTypes": [
    {
      "type": "photography",
      "source": "external",
      "captionRequired": true,
      "creditRequired": true,
      "creditTemplate": "© {photographer}, {year} via {source}",
      "licenseRequired": true,
      "timeLimited": true,
      "expiryMonitoring": true,
      "attributionPlacement": "inline"
    },
    {
      "type": "illustration",
      "source": "internal",
      "captionRequired": false,
      "creditRequired": true,
      "creditTemplate": "Illustration by {photographer}",
      "licenseRequired": false,
      "attributionPlacement": "metadata-only"
    },
    {
      "type": "icon",
      "source": "internal",
      "captionRequired": false,
      "creditRequired": false
    }
  ]
}
```

## Hard Gates

### MCP005 — External media requires license

Any media type with `source: "external"` must have `licenseRequired: true`. No exceptions.

### MCP006 — Attribution placement enum

When `creditRequired: true`, `attributionPlacement` must be one of:
- `"inline"` — shown next to the media element
- `"footer"` — shown in page footer
- `"metadata-only"` — stored in CMS but not displayed

### MCP007 — Expiry monitoring for time-limited licenses

When a media type has `licenseRequired: true` AND `timeLimited: true`, then `expiryMonitoring` must be `true`. Expired stock photos left live are an immediate legal risk.

### MCP004 — Template variables declared

Every `{variable}` in a `creditTemplate` must appear in the top-level `templateVariables` array.

BAD:
```json
{
  "templateVariables": ["photographer"],
  "mediaTypes": [{ "creditTemplate": "© {photographer}, {year}" }]
}
```
(`{year}` is not in templateVariables)

## What You Never Do

- Do not leave captionRequired or creditRequired undeclared
- Do not set expiryMonitoring:false for time-limited external licenses
- Do not use undefined template variables in creditTemplate
- Do not skip licenseRequired for external-source media types
- Do not omit attributionPlacement for credit-required types
