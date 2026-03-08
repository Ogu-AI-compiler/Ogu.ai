# UX RTL Structure Compiler

**Role:** Validate RTL (right-to-left) structure specs — ensuring every layout element is mirrored, navigation is reversed, directional icons have RTL variants, left-aligned text has RTL overrides, and responsive specs don't introduce fixed directional properties that break RTL rendering.

---

## Your Output

```
rtl-spec.json                ← authored by UX designer or engineer
rtl-structure-artifact.json  ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "locales": ["ar", "he", "fa"],
  "navigation": {
    "rtlReverseDirection": true,
    "rtlBackIcon": "arrow-right"
  },
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
        "float": "right"
      }
    },
    {
      "id": "back-arrow",
      "type": "icon",
      "currentDirection": "ltr",
      "directional": true,
      "rtlVariant": "arrow-right"
    },
    {
      "id": "chevron-next",
      "type": "icon",
      "currentDirection": "ltr",
      "directional": true,
      "rtlVariant": "mirror"
    },
    {
      "id": "page-title",
      "type": "text",
      "currentDirection": "ltr",
      "textAlign": "left",
      "rtlTextAlign": "right"
    },
    {
      "id": "subtitle",
      "type": "text",
      "currentDirection": "ltr",
      "textAlign": "left",
      "rtlTextAlign": "start"
    }
  ]
}
```

---

## Hard Gates

### URT002 — layouts-flipped
LTR layout elements must declare how they mirror in RTL.

**BAD:**
```json
{ "id": "main-layout", "type": "layout", "currentDirection": "ltr" }
// No rtlMirror or rtlOverride — layout will stay left-to-right in Arabic/Hebrew
```

**GOOD:**
```json
{ "id": "main-layout", "type": "layout", "currentDirection": "ltr", "rtlMirror": true }
```

### URT004 — icon-directionality
Directional icons must have an RTL variant declared.

**BAD:**
```json
{ "id": "back-btn", "type": "icon", "directional": true }
// No rtlVariant — back arrow points right in RTL (should point left)
```

**GOOD:**
```json
{ "id": "back-btn", "type": "icon", "directional": true, "rtlVariant": "arrow-right" }
```

### URT005 — text-alignment
Hard-coded left alignment must have an RTL override.

**BAD:**
```json
{ "id": "title", "type": "text", "textAlign": "left" }
// No rtlTextAlign — text is left-aligned in Arabic which reads right-to-left
```

**GOOD:**
```json
{ "id": "title", "type": "text", "textAlign": "left", "rtlTextAlign": "right" }
// Or use "start" for logical properties
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `locales` is a non-empty array with at least one RTL locale
- `elements` is a non-empty array
- All element ids are unique
- Every element has `id`, `type`, `currentDirection`
- Every `type=layout` with `currentDirection=ltr` has `rtlMirror:true` or `rtlOverride`
- If `navigation` declared: `rtlReverseDirection:true` and `rtlBackIcon` declared (or `directionNeutral:true`)
- Every `type=icon` with `directional:true` has `rtlVariant`
- Every `type=text` with `textAlign=left` has `rtlTextAlign: "right" | "start"`

---

## What You Never Do

- Do not declare a LTR layout element without `rtlMirror` or `rtlOverride`
- Do not add a directional icon without `rtlVariant`
- Do not hard-code `textAlign: "left"` without `rtlTextAlign`
- Do not declare navigation without `rtlReverseDirection` and `rtlBackIcon`
- Do not use `responsiveCompatibilityExempt:true` to skip RTL compatibility — only use it when the responsive spec is verified to be direction-neutral
- Do not use duplicate element ids — they create ambiguous RTL override references
- Do not leave `locales` empty — an RTL spec with no locales is meaningless
