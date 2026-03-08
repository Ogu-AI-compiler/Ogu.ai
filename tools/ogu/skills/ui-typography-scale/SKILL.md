---
name: ui-typography-scale
description: Compiler skill for the ui-typography-scale compiler. Activates when producing typography-scale-artifact.json. Gates: UTS001–UTS008. No upstream dependency.
---

# ui-typography-scale — Compiler Skill

## What This Compiler Does

Compiles the application's typography scale — a complete set of text styles from headings to body copy. Enforces: every step declares `fontSize`, `lineHeight`, and `fontWeight`; font sizes ≥ 12px; body text line-height ≥ 1.4 (WCAG SC 1.4.12); no negative letter-spacing on body text; i18n font stacks for non-Latin scripts when declared; and required heading/body steps with a declared base size and font family.

**Upstream dependency:** none
**Output artifact:** `typography-scale-artifact.json`
**IR identifier:** `TYPOGRAPHY_SCALE`

---

## Spec Shape

```json
{
  "baseSize": "16px",
  "fontFamily": "Inter, system-ui, sans-serif",
  "steps": [
    {
      "id": "h1",
      "name": "Heading 1",
      "fontSize": "36px",
      "lineHeight": 1.2,
      "fontWeight": 700,
      "letterSpacing": "-0.02em"
    },
    {
      "id": "h2",
      "name": "Heading 2",
      "fontSize": "30px",
      "lineHeight": 1.25,
      "fontWeight": 600,
      "letterSpacing": "-0.01em"
    },
    {
      "id": "h3",
      "name": "Heading 3",
      "fontSize": "24px",
      "lineHeight": 1.3,
      "fontWeight": 600
    },
    {
      "id": "body",
      "name": "Body",
      "isBodyText": true,
      "fontSize": "16px",
      "lineHeight": 1.5,
      "fontWeight": 400,
      "letterSpacing": "0em"
    },
    {
      "id": "body-sm",
      "name": "Body Small",
      "fontSize": "14px",
      "lineHeight": 1.5,
      "fontWeight": 400
    },
    {
      "id": "caption",
      "name": "Caption",
      "fontSize": "12px",
      "lineHeight": 1.4,
      "fontWeight": 400
    },
    {
      "id": "label",
      "name": "Label",
      "fontSize": "14px",
      "lineHeight": 1.4,
      "fontWeight": 500
    }
  ],
  "i18n": {
    "scripts": ["arabic", "cjk"],
    "fontStacks": {
      "arabic": "Noto Sans Arabic, Arial, sans-serif",
      "cjk": "Noto Sans CJK, PingFang SC, Hiragino Sans, sans-serif"
    }
  }
}
```

### Required Steps

The following step ids must be declared: `h1`, `h2`, `body`.

### Body Step Identification

The body step is found by:
1. `isBodyText: true` flag (explicit)
2. Or `id`/`name` matching: `body`, `base`, `text`, `paragraph`, `p`, `md`, `default`

### Valid Font Weights

Numeric: `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`
String: `thin`, `extralight`, `light`, `regular`, `medium`, `semibold`, `bold`, `extrabold`, `black`

---

## Gates

### UTS001 — spec-valid
Reads `typography-scale-spec.json`. Required field: `steps` (non-empty array).

BAD: File missing or `steps` empty.
GOOD: At least one step in the array.

### UTS002 — steps-complete
Every scale step must declare `fontSize`, `lineHeight`, and `fontWeight`. All three required.

BAD:
```json
{ "id": "h1", "fontSize": "36px" }
// lineHeight and fontWeight missing
```
GOOD:
```json
{ "id": "h1", "fontSize": "36px", "lineHeight": 1.2, "fontWeight": 700 }
```

### UTS003 — min-font-size
No step may have `fontSize` below 12px (= 0.75rem). Applies to parseable values; token references are skipped.

BAD:
```json
{ "id": "micro", "fontSize": "10px" }
// below 12px minimum
```
GOOD:
```json
{ "id": "caption", "fontSize": "12px" }
```

### UTS004 — body-line-height
The body text step must have `lineHeight` ≥ 1.4 (WCAG SC 1.4.12 minimum). Body step identified by `isBodyText: true` or by common ids.

BAD:
```json
{ "id": "body", "fontSize": "16px", "lineHeight": 1.2 }
// 1.2 < 1.4 minimum
```
GOOD:
```json
{ "id": "body", "fontSize": "16px", "lineHeight": 1.5 }
```

### UTS005 — no-negative-tracking
The body text step must not have a negative `letterSpacing` value. Negative tracking reduces legibility for body text.

Heading steps may use negative tracking (common for display text). Only body step is checked.

BAD:
```json
{ "id": "body", "letterSpacing": "-0.02em" }
// negative tracking on body text
```
GOOD:
```json
{ "id": "body", "letterSpacing": "0em" }
{ "id": "h1", "letterSpacing": "-0.02em" }
// negative tracking on headings is fine
```

### UTS006 — i18n-stacks
Skipped if `spec.i18n` is not declared.

When `spec.i18n.scripts` is declared, every listed script must have a corresponding entry in `spec.i18n.fontStacks`.

BAD:
```json
{
  "i18n": {
    "scripts": ["arabic", "cjk"],
    "fontStacks": {
      "arabic": "Noto Sans Arabic, sans-serif"
      // cjk missing!
    }
  }
}
```
GOOD: Every script in `i18n.scripts` has a font stack in `i18n.fontStacks`.

### UTS007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### UTS008 — contract-typography
Four contract rules:

| Rule | Requirement |
|---|---|
| `heading-and-body-declared` | Steps with ids `h1`, `h2`, `body` must exist |
| `font-family-declared` | `spec.fontFamily` or `spec.fontFamilies` must be declared |
| `valid-font-weights` | All `fontWeight` values must be valid CSS weights |
| `base-size-declared` | `spec.baseSize` or `spec.base` must be declared |

BAD: Missing `h1` or `body` step, no `fontFamily`, invalid fontWeight `"bolder"`, no `baseSize`.
GOOD:
```json
{
  "baseSize": "16px",
  "fontFamily": "Inter, system-ui, sans-serif",
  "steps": [
    { "id": "h1", "fontWeight": 700, ... },
    { "id": "h2", "fontWeight": 600, ... },
    { "id": "body", "fontWeight": 400, ... }
  ]
}
```

---

## What This Compiler Never Forgives

- `typography-scale-spec.json` missing (UTS001 hard-fails)
- `steps` empty or missing (UTS001)
- Any step missing `fontSize`, `lineHeight`, or `fontWeight` (UTS002)
- Font size below 12px (UTS003)
- Body step line-height below 1.4 (UTS004)
- Cannot identify body step — no `isBodyText: true` and no common body id (UTS004)
- Body step with negative `letterSpacing` (UTS005)
- Non-Latin script declared in `i18n.scripts` with no font stack (UTS006)
- Step ids `h1`, `h2`, or `body` missing (UTS008)
- No `fontFamily`/`fontFamilies` declared (UTS008)
- `fontWeight` value not a valid CSS weight (UTS008)
- No `baseSize`/`base` declared (UTS008)
