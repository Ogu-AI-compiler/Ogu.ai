---
name: alt-text-policy
description: Compiler skill for the alt-text-policy compiler. Activates when producing alt-text-artifact.json. Gates: ALT001–ALT007 + no-todos. Hard-fails when spec missing.
---

# alt-text-policy — Compiler Skill

## What This Compiler Does

Compiles alt text policies for CMS image fields — validates spec structure (image usage contexts), requires each context to explicitly declare whether alt text is mandatory, requires decorative images to be properly aria-hidden, enforces character length limits, requires a prohibited phrases list (blocks "image of", "photo of", etc.), requires CMS field references per context, and requires an AI auto-generation policy declaration per context.

**Upstream dependency:** none
**Output artifact:** `alt-text-artifact.json`
**IR identifier:** `ALT_TEXT_POLICY:{project}`

---

## Spec Shape

**`alt-text-policy.spec.json`**:
```json
{
  "contexts": [
    {
      "name": "hero-image",
      "altTextRequired": true,
      "maxLength": 100,
      "cmsField": "heroImage.alt",
      "autoGeneration": "not-allowed"
    },
    {
      "name": "decorative-divider",
      "altTextRequired": false,
      "emptyAltPermitted": true,
      "ariaHidden": true,
      "cmsField": "divider.decorative",
      "autoGeneration": "not-allowed"
    }
  ],
  "prohibitedPhrases": ["image of", "photo of", "picture of", "graphic of"]
}
```

Required fields:
- `contexts` — non-empty array of image usage contexts, each with `name`
- `prohibitedPhrases` — array (must include "image of", "photo of", "picture of")

---

## Gates

### ALT001 — spec-valid
Reads `alt-text-policy.spec.json`. Hard-fails if missing. Required: `contexts` non-empty array, each context must have a `name` string.

BAD: spec missing or `contexts: []` or any context without `name`.
GOOD: `contexts` array with at least one named context.

### ALT002 — context-required-declared
Every image context must explicitly declare `altTextRequired` as a boolean.

BAD:
```json
{ "name": "hero-image" }
// altTextRequired absent — policy is ambiguous
```
GOOD:
```json
{ "name": "hero-image", "altTextRequired": true }
// OR
{ "name": "decorative-icon", "altTextRequired": false }
```

### ALT003 — decorative-marked
Contexts with `altTextRequired: false` (decorative images) must declare both `emptyAltPermitted: true` AND `ariaHidden: true`. Skips if no decorative contexts exist.

BAD:
```json
{ "name": "divider", "altTextRequired": false }
// Missing emptyAltPermitted and ariaHidden — screen readers will announce the image
```
GOOD:
```json
{
  "name": "divider",
  "altTextRequired": false,
  "emptyAltPermitted": true,
  "ariaHidden": true
}
```

### ALT004 — max-length-defined
Every non-decorative context must declare `maxLength` as a positive number. Values over 125 characters require `longAltOk: true` (screen readers truncate beyond ~125 chars).

BAD:
```json
{ "name": "product-photo", "altTextRequired": true }
// maxLength not declared — no character constraint enforced in CMS
```
GOOD:
```json
{ "name": "product-photo", "altTextRequired": true, "maxLength": 100 }
// OR for intentionally long alt text:
{ "name": "infographic", "altTextRequired": true, "maxLength": 200, "longAltOk": true }
```

### ALT005 — prohibited-phrases-declared
`spec.prohibitedPhrases` array must exist and include at minimum: `"image of"`, `"photo of"`, `"picture of"`. These are the most common useless alt text patterns.

BAD:
```json
{ "contexts": [...] }
// prohibitedPhrases absent — CMS accepts "image of a dog" as valid alt text
```
GOOD:
```json
{
  "prohibitedPhrases": ["image of", "photo of", "picture of", "graphic of", "icon of"]
}
```

### ALT006 — cms-field-referenced
Every context must declare `cmsField` — which CMS field stores the alt text for this image type. Ensures the policy is wired to actual content model fields.

BAD:
```json
{ "name": "hero-image", "altTextRequired": true, "maxLength": 100 }
// cmsField missing — policy is disconnected from the CMS
```
GOOD:
```json
{ "name": "hero-image", "altTextRequired": true, "maxLength": 100, "cmsField": "heroImage.alt" }
```

### ALT007 — auto-generation-declared
Every context must declare `autoGeneration` as either `"allowed"` or `"not-allowed"`. Leaving this undeclared means AI-generated alt text may be silently enabled or disabled without a conscious policy decision.

BAD:
```json
{ "name": "blog-thumbnail", "altTextRequired": true, "maxLength": 100, "cmsField": "thumbnail.alt" }
// autoGeneration not declared
```
GOOD:
```json
{
  "name": "blog-thumbnail",
  "altTextRequired": true,
  "maxLength": 100,
  "cmsField": "thumbnail.alt",
  "autoGeneration": "allowed"
}
```

### ALT008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `alt-text-policy.spec.json` missing (ALT001 hard-fails)
- `contexts` array empty or missing (ALT001)
- Any context missing `name` (ALT001)
- `altTextRequired` not declared on any context (ALT002)
- Decorative context (`altTextRequired: false`) missing `emptyAltPermitted: true` or `ariaHidden: true` (ALT003)
- Non-decorative context missing `maxLength` (ALT004)
- `maxLength > 125` without `longAltOk: true` (ALT004)
- `prohibitedPhrases` not declared (ALT005)
- `prohibitedPhrases` missing "image of", "photo of", or "picture of" (ALT005)
- Any context missing `cmsField` (ALT006)
- Any context missing `autoGeneration` declaration (ALT007)
- TODO/FIXME/HACK/XXX anywhere (ALT008)
