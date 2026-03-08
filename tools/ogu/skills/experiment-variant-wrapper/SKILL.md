---
name: experiment-variant-wrapper
description: Compiler skill for the experiment-variant-wrapper compiler. Activates when producing experiment-variant-artifact.json. Gates: EV001–EV010. No upstream dependency.
---

# experiment-variant-wrapper — Compiler Skill

## What This Compiler Does

Compiles an A/B experiment variant wrapper component — the React boundary that renders different UX based on an experiment variant assignment. Enforces: control/fallback variant always rendered (no missing branch), exposure tracking fires exactly once via `useEffect`, no branching sprawl (≤ 5 variant comparisons per file, no nested experiments), and the experiment hook is used with exposure tracking.

**Upstream dependency:** none (cross-checks `feature-flag-artifact.json` if present)
**Output artifact:** `experiment-variant-artifact.json`
**IR identifier:** `EXPERIMENT_VARIANT:{experiment_id}`

---

## Spec Shape

```json
{
  "experiment_id": "checkout-button-cta",
  "variants": ["control", "treatment-a", "treatment-b"],
  "fallback_variant": "control"
}
```

Required fields:
- `experiment_id` — unique experiment identifier
- `variants` — at least 2 entries (control + treatment)
- `fallback_variant` — must be in `variants` array

---

## Implementation Shape

```tsx
import { useExperiment } from '@/lib/experiments';

export function CheckoutButtonExperiment({ children }: { children: ReactNode }) {
  const variant = useExperiment('checkout-button-cta');

  useEffect(() => {
    trackExposure('checkout-button-cta');
  }, []); // fires exactly once on mount

  if (variant === 'treatment-a') {
    return <TreatmentA />;
  }
  if (variant === 'treatment-b') {
    return <TreatmentB />;
  }

  // Always render control/fallback
  return <Control />;
}
```

---

## Gates

### EV001 — spec-valid
Reads `experiment-variant-spec.json`. Required: `experiment_id`, `variants` (array with ≥ 2 entries), `fallback_variant`. `fallback_variant` must be in `variants`.

BAD: Only 1 variant (no treatment), or `fallback_variant: "control"` not in variants array.
GOOD: `{ "variants": ["control", "treatment"], "fallback_variant": "control" }`

### EV002 — no-any
No `: any` type annotations.

### EV003 — ts-valid
TypeScript files must compile.

### EV004 — fallback-variant
The implementation must:
1. Define a fallback/control variant path
2. Have conditional rendering based on variant value (`variant ===`, `switch(variant)`, or ternary)

BAD: No `fallback`/`control` keyword in source — fallback variant not handled.
BAD: No conditional on variant — all users see same UI regardless of assignment.
GOOD: Control/fallback case explicitly handled, variant switching present.

### EV005 — single-exposure
Exposure tracking must:
1. Exist exactly once (`trackExposure(`, `logExposure(`, `expose(`, `recordExposure(`)
2. Be inside `useEffect` with `[]` dependency (fires once on mount)

BAD: No exposure tracking call — experiment data invalid.
BAD: 2+ exposure calls — double-counting.
BAD: Exposure call outside `useEffect` — fires on every render.

GOOD:
```tsx
useEffect(() => {
  trackExposure('experiment-id');
}, []);
```

### EV006 — no-branching-sprawl
Two limits:
1. ≤ 5 `variant === 'value'` comparisons in a single file
2. No nested experiments (`useExperiment` called twice in the same file within 200 characters of each other)

BAD: 8 variant branches in one wrapper — split into separate components.
BAD: `useExperiment` inside a variant branch — nested experiments.
GOOD: ≤ 5 clean branches, experiments at top level only.

### EV007 — tests-pass
All tests pass.

### EV008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### EV009 — cross-flag
Skipped if `feature-flag-artifact.json` not found. When present, it must have passed — experiment variants depend on working flag infrastructure.

### EV010 — contract-experiment
Four contract rules:

| Rule | Requirement |
|---|---|
| `uses-hook` | `useExperiment()`, `useFeatureFlag()`, or `useVariant()` called |
| `has-fallback` | `fallback`/`control`/`CONTROL` keyword present |
| `exposure-tracked` | `trackExposure`, `logExposure`, or `recordExposure` called |
| `exported` | Component/hook is exported |

---

## What This Compiler Never Forgives

- `experiment-variant-spec.json` missing (EV001 hard-fails)
- Fewer than 2 variants (EV001)
- `fallback_variant` not in variants array (EV001)
- No fallback/control variant handled in conditional rendering (EV004)
- No conditional rendering on variant (EV004)
- No exposure tracking call (EV005)
- Exposure tracking not in `useEffect` (EV005)
- Multiple exposure tracking calls (EV005)
- More than 5 variant branches in one file (EV006)
- Nested `useExperiment` calls (EV006)
- `feature-flag-artifact.json` present but failed (EV009)
- No experiment hook (`useExperiment`/`useFeatureFlag`) used (EV010)
- Component not exported (EV010)
