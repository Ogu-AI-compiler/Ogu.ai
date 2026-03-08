---
name: ui-state-appearance
description: Compiler skill for the ui-state-appearance compiler. Activates when producing state-appearance-artifact.json. Gates: USA001–USA008. No upstream dependency.
---

# ui-state-appearance — Compiler Skill

## What This Compiler Does

Compiles the visual state appearance specification — the full set of interactive and functional states for each component, with unique visual treatment per state. Enforces: all 6 required states declared (default, hover, focus, active, disabled, error), each state has at least one perceivable visual difference from default, focus state declares a visible focus indicator, disabled state uses opacity or disabled semantic tokens, and skeleton state matches component geometry.

**Upstream dependency:** none
**Output artifact:** `state-appearance-artifact.json`
**IR identifier:** `STATE_APPEARANCE`

---

## Spec Shape

```json
{
  "components": [
    {
      "id": "Button",
      "states": {
        "default": {
          "background": "{color.button.bg}",
          "text": "{color.button.text}",
          "border": "{color.button.border}"
        },
        "hover": {
          "background": "{color.button.bg-hover}",
          "cursor": "pointer"
        },
        "focus": {
          "background": "{color.button.bg}",
          "focusRing": "{color.focus.ring}",
          "outline": "{color.focus.ring}"
        },
        "active": {
          "background": "{color.button.bg-active}"
        },
        "disabled": {
          "opacity": 0.4,
          "cursor": "not-allowed"
        },
        "error": {
          "border": "{color.destructive.default}",
          "text": "{color.destructive.text}"
        }
      }
    },
    {
      "id": "Input",
      "statesNotApplicable": ["active"],
      "states": {
        "default":  { "border": "{color.border.default}", "background": "{color.surface.default}" },
        "hover":    { "border": "{color.border.hover}" },
        "focus":    { "border": "{color.border.focus}", "outline": "{color.focus.ring}" },
        "disabled": { "opacity": 0.4, "cursor": "not-allowed" },
        "error":    { "border": "{color.destructive.default}" }
      }
    }
  ]
}
```

### Required 6 States

| State | Purpose |
|---|---|
| `default` | Base appearance |
| `hover` | Mouse-over interaction |
| `focus` | Keyboard focus / click focus |
| `active` | Pressed/clicked state |
| `disabled` | Non-interactive state |
| `error` | Validation failure |

Escape hatch: `statesNotApplicable: ["active"]` — for components where a state doesn't apply (e.g. static labels).

---

## Gates

### USA001 — spec-valid
Reads `state-appearance-spec.json`. Required: `components` (non-empty array). Each component needs `id` and `states` (object).

BAD: Missing `components`, or a component with no `id` or no `states`.
GOOD: All components have `id` and `states`.

### USA002 — states-complete
Every component must declare all 6 required states: `default`, `hover`, `focus`, `active`, `disabled`, `error`.

Components can opt out via `statesNotApplicable: ["active"]`.

BAD:
```json
{
  "id": "Button",
  "states": {
    "default": {...},
    "hover": {...}
    // focus, active, disabled, error missing!
  }
}
```
GOOD: All 6 states declared, or explicitly opted out via `statesNotApplicable`.

### USA003 — focus-contrast
Every `focus` state must declare a visible focus indicator: `focusRing`, `outline`, or `boxShadow` property. A focus state without a visible ring is invisible to keyboard users.

Escape hatch: `focusContrastOk: true` in the focus state.

BAD:
```json
{
  "focus": {
    "background": "{color.button.bg-focus}"
    // no focusRing, outline, or boxShadow — invisible!
  }
}
```
GOOD:
```json
{
  "focus": {
    "background": "{color.button.bg}",
    "focusRing": "{color.focus.ring}",
    "outline": "{color.focus.ring}"
  }
}
```

### USA004 — disabled-opacity
Disabled state must communicate non-interactivity via `opacity` property OR a token containing `disabled`/`muted`/`dimmed` in its name.

Escape hatch: `disabledOpacityOk: true` in the disabled state.

BAD:
```json
{
  "disabled": {
    "background": "{color.gray.200}",
    "text": "{color.gray.400}"
    // no opacity, no disabled token — only color change, insufficient
  }
}
```
GOOD:
```json
{
  "disabled": { "opacity": 0.4, "cursor": "not-allowed" }
}
// OR
{
  "disabled": { "background": "{color.disabled.bg}", "text": "{color.disabled.text}" }
}
```

### USA005 — unique-visual-change
Every non-default state must have at least one property that differs from the `default` state. States that are visually identical to default are invisible to users.

Escape hatch: `identicalToDefault: true` on the state (explicit acknowledgment).

BAD:
```json
{
  "default": { "background": "{color.primary}", "text": "{color.on-primary}" },
  "hover":   { "background": "{color.primary}", "text": "{color.on-primary}" }
  // hover is identical to default — no perceivable change
}
```
GOOD: Every state differs from default in at least one property.

### USA006 — skeleton-geometry
If a `skeleton` state is declared, it must match the loaded state's geometry to avoid layout shifts.

Satisfaction: `matchesGeometry: true` on the skeleton state, OR explicit `width`/`height` matching the `default` state.

BAD:
```json
{
  "skeleton": {
    "background": "{color.skeleton.pulse}"
    // no geometry match declared
  }
}
```
GOOD:
```json
{
  "skeleton": {
    "background": "{color.skeleton.pulse}",
    "matchesGeometry": true
  }
}
```

### USA007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### USA008 — contract-state
Four contract rules:

| Rule | Requirement |
|---|---|
| `component-ids-unique` | No two components share the same id |
| `default-state-has-tokens` | Every component's `default` state has at least one visual property |
| `no-empty-states` | No state is an empty object `{}` |
| `minimum-one-component` | At least one component declared |

BAD: Duplicate component id, `default: {}`, or empty `hover: {}`.
GOOD: All components have unique ids, default state with properties, no empty states.

---

## What This Compiler Never Forgives

- `state-appearance-spec.json` missing (USA001 hard-fails)
- `components` missing or empty (USA001)
- Any component missing `id` or `states` (USA001)
- Any of the 6 required states missing without `statesNotApplicable` opt-out (USA002)
- Focus state with no `focusRing`, `outline`, or `boxShadow` (USA003)
- Disabled state with no `opacity` and no `disabled`/`muted` semantic token (USA004)
- State visually identical to default with no change (USA005)
- Skeleton state with no geometry match declaration (USA006)
- Duplicate component ids (USA008)
- Default state with no visual properties (USA008)
- Any state declared as empty object `{}` (USA008)
