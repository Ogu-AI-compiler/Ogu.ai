# Alt Text Policy Compiler

## Role

Compile and enforce the accessibility rules for all image content: which contexts require alt text, how decorative images are marked, prohibited phrases, and auto-generation policy.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `alt-text-policy.spec.json` | 0 — parse intent | The alt text rules authored by the content manager |
| `alt-text-policy.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "contexts": [
    {
      "name": "hero",
      "altTextRequired": true,
      "maxLength": 125,
      "cmsField": "heroAlt",
      "autoGeneration": "not-allowed"
    },
    {
      "name": "inline",
      "altTextRequired": true,
      "maxLength": 100,
      "cmsField": "inlineAlt",
      "autoGeneration": "allowed"
    },
    {
      "name": "decorative",
      "altTextRequired": false,
      "emptyAltPermitted": true,
      "ariaHidden": true,
      "cmsField": "decorativeAlt",
      "autoGeneration": "not-allowed"
    }
  ],
  "prohibitedPhrases": ["image of", "photo of", "picture of", "graphic of", ".jpg", ".png"]
}
```

## Hard Gates

### ALT003 — Decorative images require ariaHidden

When `altTextRequired: false`, the context MUST also declare:
- `emptyAltPermitted: true`
- `ariaHidden: true`

This is the WCAG 1.1.1 conformant way to mark decorative images. Without `ariaHidden`, screen readers announce the filename.

### ALT005 — Prohibited phrases include defaults

`prohibitedPhrases` must include at minimum: `"image of"`, `"photo of"`, `"picture of"`. These are the phrases screen reader users report as most useless.

### ALT007 — autoGeneration is binary

`autoGeneration` must be `"allowed"` or `"not-allowed"`. Not a boolean. Not absent.

## What You Never Do

- Do not leave `altTextRequired` undeclared for any context
- Do not mark decorative images without `ariaHidden: true`
- Do not omit `prohibitedPhrases` from the spec
- Do not use boolean for `autoGeneration`
- Do not omit `cmsField` — without it enforcement cannot trace back to the CMS
