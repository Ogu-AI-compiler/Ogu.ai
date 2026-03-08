---
name: ui-motion-spec
description: Compiler skill for the ui-motion-spec compiler. Activates when producing motion-spec-artifact.json. Gates: UMO001–UMO007. No upstream dependency.
---

# ui-motion-spec — Compiler Skill

## What This Compiler Does

Compiles the application's motion specification — all animations with their durations, easings, and reduced-motion overrides. Enforces: durations within the 100–500ms perceptual feedback range, valid CSS easing functions, both enter and exit types declared (symmetric motion), every animation has a `prefers-reduced-motion` override, and a standard easing and a layout/move animation type are declared.

**Upstream dependency:** none
**Output artifact:** `motion-spec-artifact.json`
**IR identifier:** `MOTION_SPEC`

---

## Spec Shape

```json
{
  "easings": {
    "standard":    "cubic-bezier(0.4, 0.0, 0.2, 1.0)",
    "decelerate":  "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
    "accelerate":  "cubic-bezier(0.4, 0.0, 1.0, 1.0)",
    "sharp":       "cubic-bezier(0.4, 0.0, 0.6, 1.0)"
  },
  "animations": [
    {
      "id": "fade-in",
      "type": "enter",
      "duration": "150ms",
      "easing": "standard",
      "reducedMotion": "instant"
    },
    {
      "id": "fade-out",
      "type": "exit",
      "duration": "100ms",
      "easing": "accelerate",
      "reducedMotion": "instant"
    },
    {
      "id": "slide-in",
      "type": "enter",
      "duration": "250ms",
      "easing": "decelerate",
      "reducedMotion": "opacity-only"
    },
    {
      "id": "slide-out",
      "type": "exit",
      "duration": "200ms",
      "easing": "accelerate",
      "reducedMotion": "opacity-only"
    },
    {
      "id": "list-reorder",
      "type": "move",
      "duration": "300ms",
      "easing": "standard",
      "reducedMotion": "none"
    }
  ],
  "allowedOutOfRange": ["page-transition"]
}
```

### Animation Types

| Type | Purpose |
|---|---|
| `enter` | Element appears in the UI |
| `exit` | Element leaves the UI |
| `move` / `layout` / `transition` | Element repositions (layout animations) |

### reducedMotion Values

| Value | Meaning |
|---|---|
| `"instant"` | Snap to end state immediately |
| `"opacity-only"` | Fade only, no movement |
| `"none"` | No animation at all |
| Any string | Custom description |

---

## Gates

### UMO001 — spec-valid
Reads `motion-spec.json`. Required fields: `animations` (non-empty array), `easings` (object). Each animation needs `id`, `type`, `duration`, `easing`.

BAD: Missing `easings` object or `animations` array. Animation missing `duration`.
GOOD: All animations have `id`, `type`, `duration`, `easing`.

### UMO002 — duration-range
All animation durations must be between 100ms and 500ms (inclusive).

Rationale: < 100ms is imperceptible; > 500ms degrades perceived performance.

Escape hatch: `spec.allowedOutOfRange: ["animation-id"]` exempts specific animations.

BAD:
```json
{ "id": "tooltip-show", "duration": "50ms" }
// too fast — imperceptible
{ "id": "modal-open", "duration": "800ms" }
// too slow — degrades performance
```
GOOD:
```json
{ "id": "tooltip-show", "duration": "150ms" }
{ "id": "modal-open", "duration": "300ms" }
// page transitions with allowedOutOfRange override
{ "id": "page-transition", "duration": "600ms" }
// allowed because "page-transition" is in spec.allowedOutOfRange
```

### UMO003 — reduced-motion-required
Every animation must declare a `reducedMotion` override — not null, not undefined, not empty string.

BAD:
```json
{ "id": "fade-in", "reducedMotion": null }
{ "id": "slide-up" }
// reducedMotion field missing entirely
```
GOOD:
```json
{ "id": "fade-in", "reducedMotion": "instant" }
{ "id": "slide-up", "reducedMotion": "opacity-only" }
```

### UMO004 — easing-valid
All easing values in `spec.easings` must be valid CSS easing functions:
- CSS keywords: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`
- `cubic-bezier(x1, y1, x2, y2)` — x1 and x2 must be in [0, 1]
- `steps(N, start|end)`

Animation `easing` fields must reference a declared easing name or be an inline valid CSS easing.

BAD:
```json
{
  "easings": { "bouncy": "spring(1, 80, 10, 0)" }
}
// spring() is not valid CSS easing
{
  "animations": [{ "id": "fade", "easing": "bounce" }]
}
// "bounce" not in spec.easings and not a valid CSS keyword
```
GOOD:
```json
{
  "easings": {
    "standard": "cubic-bezier(0.4, 0.0, 0.2, 1.0)"
  },
  "animations": [{ "id": "fade", "easing": "standard" }]
}
```

### UMO005 — enter-exit-defined
Both `enter` and `exit` animation types must be declared. Asymmetric motion specs (enter-only or exit-only) are rejected.

BAD:
```json
{
  "animations": [
    { "id": "fade-in", "type": "enter" }
    // no exit animation!
  ]
}
```
GOOD: At least one animation with `type: "enter"` AND at least one with `type: "exit"`.

### UMO006 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### UMO007 — contract-motion
Three contract rules:

| Rule | Requirement |
|---|---|
| `standard-easing-declared` | An easing named `standard`, `default`, or `base` must exist |
| `animation-ids-unique` | No two animations share the same id |
| `move-type-declared` | At least one animation with type `move`, `layout`, `reorder`, or `transition` |

BAD: No standard easing, or no move/layout animation type, or duplicate animation ids.
GOOD:
```json
{
  "easings": {
    "standard": "cubic-bezier(0.4, 0.0, 0.2, 1.0)"
  },
  "animations": [
    { "id": "list-reorder", "type": "move", ... },
    { "id": "fade-in", "type": "enter", ... },
    { "id": "fade-out", "type": "exit", ... }
  ]
}
```

---

## What This Compiler Never Forgives

- `motion-spec.json` missing (UMO001 hard-fails)
- `animations` or `easings` missing or empty (UMO001)
- Any animation missing `id`, `type`, `duration`, or `easing` (UMO001)
- Duration below 100ms or above 500ms without `allowedOutOfRange` exemption (UMO002)
- Any animation missing `reducedMotion` field (UMO003)
- Easing value not a valid CSS easing function (UMO004)
- Animation `easing` referencing an undeclared easing name (UMO004)
- No `exit` animation type declared (UMO005)
- No `enter` animation type declared (UMO005)
- No easing named `standard`, `default`, or `base` (UMO007)
- Duplicate animation ids (UMO007)
- No `move`/`layout`/`transition` animation type (UMO007)
