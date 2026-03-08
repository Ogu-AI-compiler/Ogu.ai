---
name: ui-theme-manifest
description: Compiler skill for the ui-theme-manifest compiler. Activates when producing theme-manifest-artifact.json. Gates: UTH001–UTH008. No upstream dependency.
---

# ui-theme-manifest — Compiler Skill

## What This Compiler Does

Compiles the theme manifest — the per-mode mapping of semantic token names to resolved token references or hex values. Enforces: every declared semantic token has a mapping for every mode, all mapping values are valid alias references or hex colors (no raw strings), dark mode pairs meet WCAG AA contrast, high-contrast mode mappings are fully opaque (no transparency), and mode mapping keys are consistent with the canonical token list.

**Upstream dependency:** none (cross-references `design-token-spec.json` for alias resolution when present)
**Output artifact:** `theme-manifest-artifact.json`
**IR identifier:** `THEME_MANIFEST`

---

## Spec Shape

```json
{
  "modes": ["light", "dark"],
  "tokens": [
    "color.surface.default",
    "color.surface.raised",
    "color.text.primary",
    "color.text.secondary",
    "color.text.disabled",
    "color.border.default",
    "color.border.focus",
    "color.action.primary",
    "color.action.primary-hover",
    "color.action.destructive",
    "color.feedback.success",
    "color.feedback.warning"
  ],
  "mappings": {
    "light": {
      "color.surface.default":     "{color.gray.50}",
      "color.surface.raised":      "{color.white}",
      "color.text.primary":        "{color.gray.900}",
      "color.text.secondary":      "{color.gray.600}",
      "color.text.disabled":       "{color.gray.400}",
      "color.border.default":      "{color.gray.200}",
      "color.border.focus":        "{color.blue.600}",
      "color.action.primary":      "{color.blue.600}",
      "color.action.primary-hover":"{color.blue.700}",
      "color.action.destructive":  "{color.red.600}",
      "color.feedback.success":    "{color.green.600}",
      "color.feedback.warning":    "{color.yellow.500}"
    },
    "dark": {
      "color.surface.default":     "{color.gray.900}",
      "color.surface.raised":      "{color.gray.800}",
      "color.text.primary":        "{color.gray.50}",
      "color.text.secondary":      "{color.gray.400}",
      "color.text.disabled":       "{color.gray.600}",
      "color.border.default":      "{color.gray.700}",
      "color.border.focus":        "{color.blue.400}",
      "color.action.primary":      "{color.blue.400}",
      "color.action.primary-hover":"{color.blue.300}",
      "color.action.destructive":  "{color.red.400}",
      "color.feedback.success":    "{color.green.400}",
      "color.feedback.warning":    "{color.yellow.400}"
    }
  },
  "darkModeContrast": [
    {
      "label": "primary text on dark surface",
      "foreground": "#F9FAFB",
      "background": "#111827"
    }
  ]
}
```

### Key Rules

- `modes` — array of mode names; `light` is always required
- `tokens` — canonical list of semantic token names (the "contract" of the theme system)
- `mappings` — for each mode, a complete mapping of every token to `{alias}` or `#hex`
- Mode mapping keys must match `spec.tokens` exactly — extra keys indicate naming drift
- Minimum 10 semantic tokens required for a meaningful theme system
- At least one token with `surface` in its name, and one with `text`/`fg`/`foreground`

---

## Gates

### UTH001 — spec-valid
Reads `theme-manifest-spec.json`. Required fields: `modes` (non-empty array), `tokens` (non-empty array), `mappings` (object).

BAD: Missing `mappings` field or `tokens: []`.
GOOD:
```json
{
  "modes": ["light", "dark"],
  "tokens": ["color.surface.default", "color.text.primary", ...],
  "mappings": { "light": {...}, "dark": {...} }
}
```

### UTH002 — modes-complete
Every token in `spec.tokens` must have a mapping for every mode in `spec.modes`. No token may be missing from any mode mapping.

BAD:
```json
{
  "modes": ["light", "dark"],
  "tokens": ["color.text.primary", "color.border.focus"],
  "mappings": {
    "light": { "color.text.primary": "{color.gray.900}", "color.border.focus": "{color.blue.600}" },
    "dark":  { "color.text.primary": "{color.gray.50}" }
    // color.border.focus missing in dark mode!
  }
}
```
GOOD: Every token in `spec.tokens` has a mapping in every mode.

### UTH003 — token-refs-valid
Every mapping value must be either:
- A valid alias reference: `{token.name}` syntax
- A valid hex color: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`

If `design-token-spec.json` is present in the same directory, alias references are cross-checked to ensure the referenced token exists.

BAD:
```json
"color.text.primary": "gray-900"
// not an alias or hex — plain string rejected
```
```json
"color.text.primary": "{color.typo}"
// alias {color.typo} does not exist in design-token-spec.json
```
GOOD:
```json
"color.text.primary": "{color.gray.900}"
// valid alias
"color.border.focus": "#2563EB"
// valid hex
```

### UTH004 — dark-mode-contrast
Skipped if `dark` is not in `spec.modes` or `spec.darkModeContrast` is not declared.

When `darkModeContrast` is declared, each hex pair must meet WCAG AA (4.5:1).

BAD:
```json
{
  "darkModeContrast": [
    { "label": "text on dark", "foreground": "#6B7280", "background": "#111827" }
  ]
}
// 4.12:1 — fails AA in dark mode
```
GOOD: All dark mode contrast pairs ≥ 4.5:1.

### UTH005 — high-contrast-opacity
Skipped if `high-contrast` is not in `spec.modes`.

When `high-contrast` mode is declared, all its mapping values must be fully opaque — no `rgba()` with alpha < 1, no 8-digit hex with non-`ff` alpha channel.

BAD:
```json
"mappings": {
  "high-contrast": {
    "color.surface.default": "rgba(255, 255, 255, 0.9)"
    // 10% transparency — invalid for high-contrast mode
  }
}
```
GOOD: All high-contrast mappings use `{alias}` or fully opaque `#hex`.

### UTH006 — mode-name-stable
Every key in each mode's mapping must appear in `spec.tokens`. Extra keys in mode mappings indicate naming drift that will break theme switching.

BAD:
```json
{
  "tokens": ["color.text.primary"],
  "mappings": {
    "dark": {
      "color.text.primary": "{color.gray.50}",
      "color.text.body": "{color.gray.100}"
      // color.text.body not in spec.tokens — naming drift!
    }
  }
}
```
GOOD: Mode mapping keys are a subset of `spec.tokens` (same names, same spelling).

### UTH007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### UTH008 — contract-theme
Four contract rules:

| Rule | Requirement |
|---|---|
| `light-mode-required` | `"light"` must be in `spec.modes` — universal fallback |
| `minimum-ten-tokens` | At least 10 semantic tokens declared |
| `surface-and-text` | At least one token with `surface` in the name, one with `text`/`fg`/`foreground` |
| `mappings-match-modes` | Every declared mode has an entry in `spec.mappings` |

BAD:
```json
{
  "modes": ["dark"],
  // "light" missing — fails light-mode-required
  "tokens": ["color.primary", "color.secondary"],
  // only 2 tokens — fails minimum-ten-tokens
  ...
}
```
GOOD:
```json
{
  "modes": ["light", "dark"],
  "tokens": [
    "color.surface.default",
    "color.surface.raised",
    "color.text.primary",
    "color.text.secondary",
    "color.text.disabled",
    "color.border.default",
    "color.border.focus",
    "color.action.primary",
    "color.action.destructive",
    "color.feedback.success"
  ],
  // 10 tokens, includes "surface" and "text" — passes
  ...
}
```

---

## What This Compiler Never Forgives

- `theme-manifest-spec.json` missing (UTH001 hard-fails)
- `modes`, `tokens`, or `mappings` missing or empty (UTH001)
- Any token in `spec.tokens` missing from any mode mapping (UTH002)
- Mapping value is not a `{alias}` reference or valid hex (UTH003)
- Alias `{token.name}` not found in `design-token-spec.json` when that file is present (UTH003)
- Dark mode contrast pair failing WCAG AA 4.5:1 (UTH004)
- High-contrast mode mapping using rgba/8-digit hex with transparency (UTH005)
- Mode mapping key not listed in `spec.tokens` — naming drift (UTH006)
- `"light"` mode not declared (UTH008)
- Fewer than 10 semantic tokens (UTH008)
- No `surface` token declared (UTH008)
- No `text`/`fg`/`foreground` token declared (UTH008)
- A declared mode has no entry in `spec.mappings` (UTH008)
