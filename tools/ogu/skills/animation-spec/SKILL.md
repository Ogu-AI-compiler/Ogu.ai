---
name: animation-spec
description: Compiler skill for the animation-spec compiler. Activates when producing animation-spec-artifact.json. Gates: AN001–AN011. No upstream dependency.
---

# animation-spec — Compiler Skill

## What This Compiler Does

Compiles a Framer Motion (or CSS/Tailwind) animation variant spec. Enforces: valid easing curves (Framer presets or cubic-bezier), durations within 50–2000ms, GPU-accelerated properties only (no layout-thrashing), reduced-motion fallback present, animation variants exported, and transform-based animations only.

**Upstream dependency:** none (optional cross-check against `tokens-artifact.json` via `spec.tokensArtifact`)
**Output artifact:** `animation-spec-artifact.json`
**IR identifier:** `ANIMATION_SPEC:{name}`

---

## Spec Shape

```json
{
  "name": "FadeSlideIn",
  "engine": "framer-motion",
  "reducedMotion": "opacity-only",
  "variants": {
    "hidden": {
      "opacity": 0,
      "y": 16,
      "transition": { "duration": 0.0, "ease": "easeOut" }
    },
    "visible": {
      "opacity": 1,
      "y": 0,
      "transition": { "duration": 0.25, "ease": "easeOut" }
    },
    "exit": {
      "opacity": 0,
      "y": -8,
      "transition": { "duration": 0.15, "ease": "easeIn" }
    },
    "reducedMotion": {
      "opacity": 1,
      "y": 0
    }
  }
}
```

### Supported Engines

- `framer-motion` (default) — Framer Motion variants
- `tailwind` — Tailwind CSS animation classes
- `css` — CSS keyframe animations

### Duration Convention (Framer Motion)

Framer Motion uses **seconds**, not milliseconds. Values < 10 are treated as seconds (e.g. `0.25` = 250ms). Values ≥ 10 are treated as milliseconds.

---

## Gates

### AN001 — spec-valid
Reads `animation-spec.json`. Required fields: `name`, `variants` (object with named states, not an array). Optional `engine` must be `framer-motion`, `tailwind`, or `css`.

BAD: `variants: []` — array, not object. Unknown engine `"gsap"`.
GOOD: `{ "name": "FadeIn", "variants": { "hidden": {...}, "visible": {...} } }`

### AN002 — easing-valid
All easing values in variant `ease` and `transition.ease` must be:
- Framer Motion presets: `linear`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`
- `cubic-bezier(x1, y1, x2, y2)` string
- Array form: `[x1, y1, x2, y2]` (4 numbers)

BAD:
```json
{ "ease": "spring-bouncy" }
// not a known Framer preset
```
GOOD:
```json
{ "ease": "easeOut" }
{ "ease": "cubic-bezier(0.4, 0.0, 0.2, 1.0)" }
{ "ease": [0.4, 0.0, 0.2, 1.0] }
```

### AN005 — reduced-motion
Either `spec.reducedMotion` is declared with a `reducedMotion`/`reduced-motion` variant in `variants`, OR implementation files contain one of:
- `prefers-reduced-motion` CSS media query
- `motion-reduce:` Tailwind prefix
- `useReducedMotion()` Framer hook
- `reducedMotion` prop on `AnimatePresence`

BAD: No reduced-motion handling anywhere — users who prefer reduced motion see full animations.
GOOD:
```tsx
const prefersReduced = useReducedMotion();
const activeVariants = prefersReduced ? staticVariants : animatedVariants;
```

### AN006 — no-layout-thrash
Variants must not animate layout-triggering properties: `width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `borderWidth`, `fontSize`, `lineHeight`.

Use GPU-accelerated alternatives:
- `width` → `scaleX`
- `height` → `scaleY`
- `top`/`left` → `y`/`x` (transforms)

BAD:
```json
{ "visible": { "height": "auto", "width": "200px" } }
```
GOOD:
```json
{ "visible": { "scaleY": 1, "scaleX": 1 } }
```

### AN007 — duration-bounds
Durations must be within 50ms–2000ms. Framer Motion seconds: 0.05–2.0. Raw ms: 50–2000.

BAD:
```json
{ "transition": { "duration": 0.01 } }
// 10ms — imperceptibly fast
{ "transition": { "duration": 5.0 } }
// 5000ms — feels broken
```
GOOD:
```json
{ "transition": { "duration": 0.25 } }
// 250ms — feedback range
```

### AN008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### AN009 — ts-valid
TypeScript source files must compile without errors.

### AN010 — cross-tokens
Skipped if `spec.tokensArtifact` not declared. When declared, validates that animation token references exist in the compiled tokens artifact.

### AN011 — contract-animation
Four contract rules:

| Rule | Requirement |
|---|---|
| `variants-exported` | Animation variants must be exported: `export const FadeInVariants = {...}` |
| `reduced-motion-variant` | `reducedMotion`/`useReducedMotion`/`motion-reduce:` present |
| `no-inline-style-animation` | Fewer than 3 `style={{ transition: ... }}` inline patterns |
| `transform-only` | No `animate={{ width, height, top, left, margin, padding }}` |

---

## What This Compiler Never Forgives

- `animation-spec.json` missing (AN001 hard-fails)
- `name` or `variants` missing (AN001)
- `variants` is an array instead of object (AN001)
- Unknown `engine` value (AN001)
- Easing not in Framer presets or valid cubic-bezier (AN002)
- No reduced-motion fallback in spec or implementation (AN005)
- Animating `width`, `height`, `top`, `left` instead of transforms (AN006)
- Duration below 50ms or above 2000ms (AN007)
- Animation variants not exported (AN011)
- `animate={{ width, height }}` layout-thrashing (AN011)
