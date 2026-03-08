---
name: ui-component-variant
description: Compiler skill for the ui-component-variant compiler. Activates when producing component-variant-artifact.json. Gates: UCV001–UCV008. No upstream dependency.
---

# ui-component-variant — Compiler Skill

## What This Compiler Does

Compiles the visual variant system for a single component — the full set of visual states a component can take across intents, sizes, and modes. Enforces: all variant visual values are design token references (no raw hex/px), mode coverage for every declared mode, destructive variants use destructive semantic tokens, every declared prop axis has variant coverage, and a default variant exists.

**Upstream dependency:** none
**Output artifact:** `component-variant-artifact.json`
**IR identifier:** `COMPONENT_VARIANT:{component}`

---

## Spec Shape

```json
{
  "component": "Button",
  "modes": ["light", "dark"],
  "props": ["intent", "size"],
  "variants": [
    {
      "id": "default",
      "isDefault": true,
      "props": { "intent": "default", "size": "md" },
      "visual": {
        "light": {
          "background": "{color.interactive.primary}",
          "text": "{color.text.on-action}",
          "border": "{color.border.interactive}"
        },
        "dark": {
          "background": "{color.interactive.primary-dark}",
          "text": "{color.text.on-action}",
          "border": "{color.border.interactive-dark}"
        }
      }
    },
    {
      "id": "destructive",
      "props": { "intent": "destructive", "size": "md" },
      "visual": {
        "light": {
          "background": "{color.destructive.default}",
          "text": "{color.text.on-action}"
        },
        "dark": {
          "background": "{color.destructive.dark}",
          "text": "{color.text.on-action}"
        }
      }
    },
    {
      "id": "sm",
      "props": { "intent": "default", "size": "sm" },
      "visual": {
        "light": {
          "background": "{color.interactive.primary}",
          "text": "{color.text.on-action}"
        },
        "dark": {
          "background": "{color.interactive.primary-dark}",
          "text": "{color.text.on-action}"
        }
      }
    }
  ]
}
```

### Key Rules

- `component` — the component name (required, non-empty string)
- `modes` — if declared, every variant must have a `visual` entry for each mode
- `props` — declared prop axes; every listed prop name must appear in at least one variant's `props`
- Each variant needs: `id`, `visual` (object keyed by mode)
- A default variant is required (id `"default"`, `isDefault: true`, or `props.variant: "default"`)
- At least 2 variants required

---

## Gates

### UCV001 — spec-valid
Reads `component-variant-spec.json`. Required fields: `component` (non-empty string), `variants` (non-empty array). Each variant needs `id` and `visual`.

BAD: Missing `component` or `variants`, or a variant with no `id` or no `visual`.
GOOD: All variants have `id` and `visual` object.

### UCV002 — tokens-only
All visual property values must be design token references (`{token.name}` syntax), CSS keywords (`transparent`, `currentColor`, `inherit`, `none`, `auto`), or plain numbers (for opacity/z-index).

BAD:
```json
{ "background": "#2563EB" }
// raw hex — not a token reference
```
GOOD:
```json
{ "background": "{color.interactive.primary}" }
{ "opacity": 0 }
{ "background": "transparent" }
```

### UCV003 — destructive-semantic
Variants with destructive intent (id or `props.intent` containing `destructive`, `danger`, `delete`, `error`, `critical`) must use a background token containing `destructive`, `danger`, `error`, or `critical` in the token name.

BAD:
```json
{
  "id": "destructive",
  "props": { "intent": "destructive" },
  "visual": {
    "light": { "background": "{color.interactive.primary}" }
    // primary token — not destructive semantic!
  }
}
```
GOOD:
```json
{ "background": "{color.destructive.default}" }
```

### UCV004 — all-modes-covered
If `spec.modes` is declared, every variant's `visual` object must have a key for every declared mode.

BAD:
```json
{
  "modes": ["light", "dark"],
  "variants": [
    {
      "id": "primary",
      "visual": { "light": { "background": "{color.primary}" } }
      // dark mode missing!
    }
  ]
}
```
GOOD: Every variant has `visual.light` and `visual.dark` when both modes are declared.

### UCV005 — prop-coverage
Every prop name listed in `spec.props` must appear as a key in at least one variant's `props` object.

BAD:
```json
{
  "props": ["intent", "size", "shape"],
  "variants": [
    { "id": "default", "props": { "intent": "default", "size": "md" } }
    // "shape" declared in spec.props but used in no variant!
  ]
}
```
GOOD: All declared prop axes have at least one variant using them.

### UCV006 — no-raw-values
Stricter than `tokens-only` — explicitly blocks hex, rgb(), rgba(), hsl(), hsla(), raw px/rem/em.

Escape hatch: `"propName__raw-value-ok": true` on the mode props object.

BAD:
```json
{ "background": "#3B82F6", "padding": "8px" }
```
GOOD:
```json
{ "background": "{color.interactive.primary}", "padding": "{spacing.2}" }
```

### UCV007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### UCV008 — contract-variant
Four contract rules:

| Rule | Requirement |
|---|---|
| `has-default-variant` | At least one variant with id `"default"`, `isDefault: true`, or `props.intent/variant: "default"` |
| `variant-ids-unique` | No two variants share the same id |
| `component-name-set` | `component` is a non-empty string |
| `minimum-two-variants` | At least 2 variants |

BAD: No default variant, or only 1 variant, or duplicate ids.
GOOD:
```json
{
  "component": "Button",
  "variants": [
    { "id": "default", "isDefault": true, "visual": {...} },
    { "id": "ghost",   "visual": {...} }
  ]
}
```

---

## What This Compiler Never Forgives

- `component-variant-spec.json` missing (UCV001 hard-fails)
- `component` field missing or empty (UCV001, UCV008)
- `variants` array empty or missing (UCV001)
- Any variant missing `id` or `visual` (UCV001)
- Visual property value not a token reference or CSS keyword (UCV002)
- Destructive-intent variant using a non-destructive background token (UCV003)
- Any variant missing visual for a declared mode (UCV004)
- A declared prop axis used in no variant (UCV005)
- Raw hex/rgb/px values in visual properties (UCV006)
- No default variant declared (UCV008)
- Duplicate variant ids (UCV008)
- Fewer than 2 variants (UCV008)
