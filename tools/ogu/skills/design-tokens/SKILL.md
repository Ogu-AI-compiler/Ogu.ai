---
name: design-tokens
description: Compiler skill for the design-tokens compiler. Activates when producing tokens-artifact.json. Gates: DT001–DT008. No upstream dependency.
---

# design-tokens — Compiler Skill

## What This Compiler Does

Compiles the project's design token system. Enforces kebab-case token key names, valid color formats, WCAG contrast ratios for declared pairs, complete dark mode counterparts when dark mode is enabled, no key collisions across categories, and a semantic token layer separate from the raw palette.

**Upstream dependency:** none
**Output artifact:** `tokens-artifact.json`
**IR identifier:** `DESIGN_TOKENS`

---

## Spec Shape

```json
{
  "colors": {
    "brand": {
      "primary": "#2563EB",
      "primary-dark": "#1D4ED8",
      "secondary": "#7C3AED"
    },
    "semantic": {
      "primary": "#2563EB",
      "secondary": "#7C3AED",
      "destructive": "#DC2626",
      "muted": "#6B7280"
    },
    "surface": {
      "background": "#FFFFFF",
      "foreground": "#111827"
    }
  },
  "spacing": {
    "1": "4px",
    "2": "8px",
    "4": "16px"
  },
  "contrastPairs": [
    { "foreground": "semantic.primary", "background": "surface.background", "level": "AA" },
    { "foreground": "surface.foreground", "background": "surface.background", "level": "AAA" }
  ],
  "darkMode": true,
  "dark": {
    "colors": {
      "primary": "#3B82F6",
      "secondary": "#8B5CF6",
      "destructive": "#EF4444",
      "muted": "#9CA3AF",
      "background": "#111827",
      "foreground": "#F9FAFB"
    }
  }
}
```

---

## Gates

### DT001 — spec-valid
Reads `tokens-spec.json`. Required: `colors` object. All color values must be valid hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), `rgb(...)`, `hsl(...)`, or `oklch(...)`.

BAD: `"primary": "blue"` — not a valid color format.
GOOD: `"primary": "#2563EB"` or `"primary": "oklch(52.7% 0.188 264.4)"`

### DT002 — naming-convention
All token keys at every nesting level must be kebab-case: `^[a-z][a-z0-9-]*$`

BAD: `"primaryColor"` — camelCase. `"Primary"` — uppercase. `"primary_color"` — underscore.
GOOD: `"primary-color"`, `"brand-blue"`, `"surface-background"`

Checked in: `colors`, `spacing`, `typography`, `radius`, `shadows`, `animation`.

### DT004 — wcag-contrast
Skipped if no `spec.contrastPairs` declared.

When `contrastPairs` is defined, each pair's contrast ratio is computed and compared against the WCAG threshold:

| Level | Size | Minimum Ratio |
|---|---|---|
| AA | normal | 4.5:1 |
| AA | large | 3.0:1 |
| AAA | normal | 7.0:1 |
| AAA | large | 4.5:1 |

BAD: `foreground: "#767676", background: "#FFFFFF"` — only 4.48:1, fails AA.
GOOD: `foreground: "#595959", background: "#FFFFFF"` — 7.0:1, passes AAA.

### DT005 — no-collisions
No token key may appear in more than one category (colors, spacing, typography, radius, shadows). Flattened keys (joined with `-`) must be unique across all categories.

### DT006 — dark-mode-pairs
Skipped if `spec.darkMode` is not set.

When `darkMode: true`: every key in `spec.colors` must have a corresponding key in `spec.dark.colors` (or `spec.darkColors`). No light-mode-only tokens.

BAD: `spec.colors` has `primary`, `secondary`, `destructive`, `muted`, `background`, `foreground` but `spec.dark.colors` only has `primary` and `background`.
GOOD: all 6 light color keys have dark counterparts.

### DT008 — contract-tokens
Four contract rules checked in `tailwind.config.ts/js` and token/theme files:

| Rule | Requirement |
|---|---|
| `tailwind-extended` | `theme: { extend: { ... } }` — not replacing default theme |
| `css-vars-defined` | CSS custom properties (`--token-name:`) or `var(--...)` used |
| `no-hardcoded-colors-in-config` | Fewer than 10 raw hex values in tailwind config |
| `semantic-layer` | `primary`, `secondary`, `destructive`, or `muted` token names exist |

BAD:
```ts
// tailwind.config.ts
theme: {
  colors: { ... } // replaces defaults — breaks tailwind built-ins
}
```
GOOD:
```ts
theme: {
  extend: {
    colors: {
      primary: 'var(--color-primary)',  // CSS var reference
      secondary: 'var(--color-secondary)',
      destructive: 'var(--color-destructive)',
      muted: 'var(--color-muted)',
    }
  }
}
```

### ts-valid / no-todos
- **ts-valid**: type definitions file must compile
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked

---

## What This Compiler Never Forgives

- `tokens-spec.json` missing (DT001 hard-fails)
- `spec.colors` missing or not an object (DT001)
- Color value not in hex/rgb/hsl/oklch format (DT001)
- Token key not in kebab-case (DT002)
- Contrast pair failing declared WCAG level (DT004)
- Token key collision across categories (DT005)
- `spec.darkMode: true` but dark color keys missing (DT006)
- Tailwind config replacing (not extending) default theme (DT008)
- No semantic token names (primary/secondary/destructive/muted) (DT008)
