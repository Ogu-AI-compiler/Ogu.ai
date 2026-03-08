---
name: ux-rtl-structure
description: Compiler skill for the ux-rtl-structure compiler. Activates when producing rtl-structure-artifact.json. Gates: URT001–URT007. No upstream dependency.
---

# ux-rtl-structure — Compiler Skill

## What This Compiler Does

Compiles the RTL (right-to-left) layout structure specification — RTL locales, element directionality, layout mirroring, navigation reversal, directional icon variants, and text alignment overrides. Enforces: LTR layout elements declare `rtlMirror` or `rtlOverride`, navigation declares `rtlReverseDirection` and `rtlBackIcon`, directional icons have `rtlVariant`, and left-aligned text has `rtlTextAlign`.

**Upstream dependency:** none
**Output artifact:** `rtl-structure-artifact.json`
**IR identifier:** `UX_RTL_STRUCTURE:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "locales": ["ar", "he", "fa"],
  "elements": [
    {
      "id": "main-layout",
      "type": "layout",
      "currentDirection": "ltr",
      "rtlMirror": true
    },
    {
      "id": "sidebar",
      "type": "layout",
      "currentDirection": "ltr",
      "rtlOverride": {
        "flexDirection": "row-reverse",
        "borderLeft": "none",
        "borderRight": "1px solid #eee"
      }
    },
    {
      "id": "back-arrow",
      "type": "icon",
      "currentDirection": "ltr",
      "directional": true,
      "rtlVariant": "mirror"
    },
    {
      "id": "next-arrow",
      "type": "icon",
      "currentDirection": "ltr",
      "directional": true,
      "rtlVariant": "arrow-left"
    },
    {
      "id": "page-title",
      "type": "text",
      "currentDirection": "ltr",
      "textAlign": "left",
      "rtlTextAlign": "right"
    }
  ],
  "navigation": {
    "rtlReverseDirection": true,
    "rtlBackIcon": "arrow-right"
  }
}
```

Required fields:
- `version` — string (required for contract gate)
- `locales` — non-empty array of RTL locale strings (e.g., `"ar"`, `"he"`, `"fa"`, `"ur"`)
- `elements` — non-empty array, each with `id`, `type`, `currentDirection`

---

## Gates

### URT001 — spec-valid
Reads `rtl-spec.json`. Required: `locales` (non-empty array of strings), `elements` (non-empty array). Each element needs: `id`, `type`, `currentDirection` (`"ltr"`, `"rtl"`, or `"auto"`).

### URT002 — layouts-flipped
Every element with `type: "layout"` and `currentDirection: "ltr"` must declare either `rtlMirror: true` or `rtlOverride` (non-null object). LTR layouts without RTL mirroring create broken mirror-image UIs.

BAD:
```json
{ "id": "main", "type": "layout", "currentDirection": "ltr" }
// No rtlMirror or rtlOverride
```
GOOD:
```json
{ "id": "main", "type": "layout", "currentDirection": "ltr", "rtlMirror": true }
{ "id": "sidebar", "type": "layout", "currentDirection": "ltr", "rtlOverride": { "flexDirection": "row-reverse" } }
```

### URT003 — navigation-reversed
When `spec.navigation` is declared, it must include:
- `rtlReverseDirection: true`
- `rtlBackIcon` (non-empty string — the RTL back arrow icon name)

Escape hatch: `spec.navigation.directionNeutral: true`

BAD:
```json
{ "navigation": { "primaryMenu": "sidebar" } }
// Missing rtlReverseDirection and rtlBackIcon
```
GOOD:
```json
{ "navigation": { "rtlReverseDirection": true, "rtlBackIcon": "arrow-right" } }
```

### URT004 — icon-directionality
Every element with `type: "icon"` and `directional: true` must declare `rtlVariant` (non-empty string — either the RTL icon name or `"mirror"` to flip via CSS).

BAD:
```json
{ "id": "back-arrow", "type": "icon", "directional": true }
// Missing rtlVariant
```
GOOD:
```json
{ "id": "back-arrow", "type": "icon", "directional": true, "rtlVariant": "mirror" }
{ "id": "next-arrow", "type": "icon", "directional": true, "rtlVariant": "arrow-left" }
```

### URT005 — text-alignment
Every element with `type: "text"` and `textAlign: "left"` must declare `rtlTextAlign` as `"right"` or `"start"`. Hard-coded `text-align: left` breaks RTL text flow.

BAD:
```json
{ "id": "title", "type": "text", "textAlign": "left" }
// No rtlTextAlign
```
GOOD:
```json
{ "id": "title", "type": "text", "textAlign": "left", "rtlTextAlign": "right" }
{ "id": "caption", "type": "text", "textAlign": "left", "rtlTextAlign": "start" }
```

### URT006 — responsive-compatible
When `spec.responsiveSpecRef` is declared (path to a responsive spec file), breakpoints in that file must not use directional CSS properties (`paddingLeft`, `marginRight`, `left`, etc.) without a corresponding RTL override key. Escape hatch: `spec.responsiveCompatibilityExempt: true`.

This gate is skipped if `responsiveSpecRef` is not declared or the referenced file does not exist.

### URT007 — contract-rtl-structure
Final contract check:
- `version` declared
- All element `id` values are unique
- At least one RTL locale declared
- At least one element declared

---

## What This Compiler Never Forgives

- `rtl-spec.json` missing — gate skipped (soft, not hard-fail)
- `locales` missing or empty (URT001)
- `elements` missing or empty (URT001)
- Element missing `id`, `type`, or invalid `currentDirection` (URT001)
- LTR layout element without `rtlMirror` or `rtlOverride` (URT002)
- Navigation declared without `rtlReverseDirection:true` or `rtlBackIcon` (URT003)
- Directional icon without `rtlVariant` (URT004)
- Left-aligned text without `rtlTextAlign: "right"` or `"start"` (URT005)
- Duplicate element ids (URT007)
- `version` missing (URT007)
