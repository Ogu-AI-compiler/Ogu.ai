---
name: ui-color-system
description: Compiler skill for the ui-color-system compiler. Activates when producing color-system-artifact.json. Gates: UCS001–UCS009. No upstream dependency.
---

# ui-color-system — Compiler Skill

## What This Compiler Does

Compiles a semantic color system with full mode coverage, WCAG contrast validation, interactive state deltas, and focus indicator compliance. Enforces: all 7 required semantic roles declared, each role has color assignments for every mode, no raw hex/rgb values in semantic role definitions (must reference design tokens), WCAG contrast ratios for declared pairings, focus indicator contrast ≥ 3:1 (WCAG 2.1 SC 1.4.11), and every role declares hover/focus/active state deltas.

**Upstream dependency:** none
**Output artifact:** `color-system-artifact.json`
**IR identifier:** `COLOR_SYSTEM`

---

## Spec Shape

```json
{
  "wcagLevel": "AA",
  "modes": ["light", "dark"],
  "semanticRoles": [
    {
      "id": "primary",
      "colors": {
        "light": { "default": "{color.blue.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.blue.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.blue.700}",
        "focus":  "{color.blue.800}",
        "active": "{color.blue.900}"
      }
    },
    {
      "id": "secondary",
      "colors": {
        "light": { "default": "{color.purple.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.purple.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.purple.700}",
        "focus":  "{color.purple.800}",
        "active": "{color.purple.900}"
      }
    },
    {
      "id": "destructive",
      "colors": {
        "light": { "default": "{color.red.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.red.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.red.700}",
        "focus":  "{color.red.800}",
        "active": "{color.red.900}"
      }
    },
    {
      "id": "success",
      "colors": {
        "light": { "default": "{color.green.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.green.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.green.700}",
        "focus":  "{color.green.800}",
        "active": "{color.green.900}"
      }
    },
    {
      "id": "warning",
      "colors": {
        "light": { "default": "{color.yellow.500}", "foreground": "{color.gray.900}" },
        "dark":  { "default": "{color.yellow.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.yellow.600}",
        "focus":  "{color.yellow.700}",
        "active": "{color.yellow.800}"
      }
    },
    {
      "id": "info",
      "colors": {
        "light": { "default": "{color.cyan.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.cyan.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.cyan.700}",
        "focus":  "{color.cyan.800}",
        "active": "{color.cyan.900}"
      }
    },
    {
      "id": "neutral",
      "colors": {
        "light": { "default": "{color.gray.600}", "foreground": "{color.white}" },
        "dark":  { "default": "{color.gray.400}", "foreground": "{color.gray.900}" }
      },
      "interactiveStates": {
        "hover":  "{color.gray.700}",
        "focus":  "{color.gray.800}",
        "active": "{color.gray.900}"
      }
    }
  ],
  "pairings": [
    {
      "label": "primary text on white",
      "foreground": "#2563EB",
      "background": "#FFFFFF",
      "requiredRatio": 4.5
    },
    {
      "label": "body text on white",
      "foreground": "#111827",
      "background": "#FFFFFF",
      "requiredRatio": 7.0
    }
  ],
  "focusIndicator": {
    "color": "#2563EB",
    "adjacentSurface": "#FFFFFF"
  }
}
```

### Required 7 Semantic Roles

| Role | Purpose |
|---|---|
| `primary` | Primary actions, key UI elements |
| `secondary` | Secondary actions, accents |
| `destructive` | Errors, danger, delete actions |
| `success` | Confirmation, positive outcomes |
| `warning` | Warnings, cautionary states |
| `info` | Informational messages |
| `neutral` | Neutral states, muted elements |

### Role Structure

Each role must have:
- `id` — matches one of the 7 required role names
- `colors` — object keyed by every declared mode, each mode containing token references
- `interactiveStates` — object with `hover`, `focus`, `active` keys

---

## Gates

### UCS001 — spec-valid
Reads `color-system-spec.json`. Required top-level fields: `semanticRoles` (non-empty array), `pairings` (non-empty array), `modes` (non-empty array).

BAD: Missing `modes` field or empty `semanticRoles`.
GOOD:
```json
{
  "modes": ["light", "dark"],
  "semanticRoles": [...],
  "pairings": [...]
}
```

### UCS002 — semantic-roles-complete
All 7 required semantic roles must be declared. Each role entry must have an `id` field matching the required name.

Required ids: `primary`, `secondary`, `destructive`, `success`, `warning`, `info`, `neutral`.

BAD: Only 4 roles declared — `info`, `success`, `warning`, `neutral` missing.
GOOD: All 7 roles present with `id` fields.

### UCS003 — contrast-ratios
Skipped if `pairings` are token references (non-resolvable). Checked only for hex-valued pairs.

WCAG thresholds from `spec.wcagLevel` (default `AA`):
- AA: 4.5:1 normal text, 3.0:1 large text
- AAA: 7.0:1 normal text, 4.5:1 large text

Each pairing may override with `requiredRatio` field.

BAD:
```json
{ "foreground": "#767676", "background": "#FFFFFF" }
// 4.48:1 — fails AA
```
GOOD:
```json
{ "foreground": "#595959", "background": "#FFFFFF" }
// 7.0:1 — passes AAA
```

### UCS004 — focus-contrast
`spec.focusIndicator` must be declared with `color` and `adjacentSurface` fields. When both are hex values, contrast must be ≥ 3.0:1 (WCAG 2.1 SC 1.4.11).

BAD: No `focusIndicator` declared — contract will also fail.
BAD:
```json
{
  "focusIndicator": { "color": "#9CA3AF", "adjacentSurface": "#FFFFFF" }
}
// only 2.85:1 — fails 3:1 requirement
```
GOOD:
```json
{
  "focusIndicator": { "color": "#2563EB", "adjacentSurface": "#FFFFFF" }
}
// 5.89:1 — passes
```

### UCS005 — no-raw-hex
Semantic role `colors` values must be token references (`{token.name}`) — not raw hex, rgb, rgba, or hsl values.

BAD:
```json
{
  "id": "primary",
  "colors": {
    "light": { "default": "#2563EB" }
  }
}
// raw hex — must reference a design token
```
GOOD:
```json
{
  "id": "primary",
  "colors": {
    "light": { "default": "{color.blue.600}" }
  }
}
```

### UCS006 — interactive-deltas
Every semantic role must define `interactiveStates` with `hover`, `focus`, and `active` keys.

BAD: Role missing `interactiveStates` entirely, or `interactiveStates` has only `hover` defined.
GOOD:
```json
{
  "id": "primary",
  "interactiveStates": {
    "hover":  "{color.blue.700}",
    "focus":  "{color.blue.800}",
    "active": "{color.blue.900}"
  }
}
```

### UCS007 — mode-coverage
Every semantic role must have a `colors` entry for every mode declared in `spec.modes`. If `modes` includes both `light` and `dark`, every role needs both.

BAD:
```json
{
  "modes": ["light", "dark"],
  "semanticRoles": [
    {
      "id": "primary",
      "colors": { "light": { "default": "{color.blue.600}" } }
      // dark mode missing!
    }
  ]
}
```
GOOD: Every role has `colors.light` and `colors.dark` when both modes are declared.

### UCS008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in spec files and any generated source.

### UCS009 — contract-color
Five contract rules:

| Rule | Requirement |
|---|---|
| `destructive-role-exists` | `destructive` semantic role must be declared |
| `focus-indicator-declared` | `spec.focusIndicator` section required |
| `wcag-level-declared` | `spec.wcagLevel` must be `"AA"` or `"AAA"` |
| `multi-mode` | At least one non-`light` mode should be declared |
| `roles-have-ids` | Every role entry must have an `id` field |

BAD: No `wcagLevel` declared, no `focusIndicator`, or `modes` array contains only `"light"`.
GOOD:
```json
{
  "wcagLevel": "AA",
  "modes": ["light", "dark"],
  "focusIndicator": { "color": "#2563EB", "adjacentSurface": "#FFFFFF" },
  "semanticRoles": [
    { "id": "destructive", ... },
    ...
  ]
}
```

---

## What This Compiler Never Forgives

- `color-system-spec.json` missing (UCS001 hard-fails)
- `semanticRoles`, `pairings`, or `modes` missing or empty (UCS001)
- Any of the 7 required roles missing: primary, secondary, destructive, success, warning, info, neutral (UCS002)
- Role missing `id` field (UCS002, UCS009)
- Hex foreground/background pair failing declared WCAG ratio (UCS003)
- `focusIndicator` not declared (UCS004, UCS009)
- Focus indicator contrast below 3:1 (UCS004)
- Semantic role `colors` using raw hex/rgb instead of `{token.name}` (UCS005)
- Role missing `interactiveStates` or missing `hover`/`focus`/`active` key (UCS006)
- Role missing `colors` for any declared mode (UCS007)
- `wcagLevel` not declared (UCS009)
- Only `light` mode declared — no dark or high-contrast mode (UCS009 warning)
