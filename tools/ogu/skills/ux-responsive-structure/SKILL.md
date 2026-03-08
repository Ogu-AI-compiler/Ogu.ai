---
name: ux-responsive-structure
description: Compiler skill for the ux-responsive-structure compiler. Activates when producing responsive-structure-artifact.json. Gates: URS001–URS007. No upstream dependency.
---

# ux-responsive-structure — Compiler Skill

## What This Compiler Does

Compiles the responsive layout structure specification — breakpoint definitions, three-tier coverage (mobile/tablet/desktop), navigation mode per breakpoint, content visibility with disclosure mechanisms, no duplicate breakpoint boundaries, and collapsible region declarations. Enforces: mobile and desktop breakpoints are always named, all three tiers are covered, hidden content has a disclosure target, nav modes are declared, and breakpoints are sorted by ascending minWidth.

**Upstream dependency:** none
**Output artifact:** `responsive-structure-artifact.json`
**IR identifier:** `UX_RESPONSIVE_STRUCTURE:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "breakpoints": [
    { "name": "mobile",  "minWidth": 0,    "layout": "single-column" },
    { "name": "tablet",  "minWidth": 768,  "layout": "two-column" },
    { "name": "desktop", "minWidth": 1280, "layout": "sidebar-main" }
  ],
  "navigation": {
    "breakpoints": {
      "mobile":  { "navMode": "hamburger" },
      "tablet":  { "navMode": "tabs" },
      "desktop": { "navMode": "sidebar" }
    }
  },
  "regions": [
    {
      "id": "sidebar-filters",
      "breakpointVisibility": {
        "mobile": { "hidden": true, "disclosureTarget": "filter-toggle-btn" },
        "tablet": { "hidden": false },
        "desktop": { "hidden": false }
      }
    }
  ],
  "collapsibleRegions": [
    {
      "id": "sidebar-filters",
      "collapsedAt": ["mobile"],
      "collapseType": "drawer"
    }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `breakpoints` — non-empty array, each with `name` (string), `minWidth` (number), `layout` (string)
- Must include breakpoints named `"mobile"` and `"desktop"`

---

## Gates

### URS001 — spec-valid
Reads `responsive-spec.json`. Required: `breakpoints` (non-empty array, each with `name`, `minWidth`, `layout`). Must include breakpoints named `"mobile"` and `"desktop"`.

BAD: breakpoints array missing `"desktop"` entry.
GOOD: array includes entries with `name: "mobile"` and `name: "desktop"`.

### URS002 — all-breakpoints-defined
Spec must define breakpoints covering all three tiers:
- Mobile tier: at least one breakpoint with `minWidth ≤ 480`
- Tablet tier: at least one breakpoint with `minWidth` between 481 and 1023
- Desktop tier: at least one breakpoint with `minWidth ≥ 1024`

Escape hatch: `spec.mobileOnly: true` or `spec.desktopOnly: true`

BAD:
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 0 },
  { "name": "desktop", "minWidth": 1024 }
] }
// Missing tablet tier (481–1023)
```
GOOD:
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 0 },
  { "name": "tablet", "minWidth": 768 },
  { "name": "desktop", "minWidth": 1280 }
] }
```

### URS003 — no-content-loss
Any region hidden at a breakpoint (`hidden: true` in `breakpointVisibility`) must declare either `disclosureTarget` (string — id of a control that reveals it) or `hiddenIntentional: true`.

BAD:
```json
{ "breakpointVisibility": { "mobile": { "hidden": true } } }
// No disclosureTarget or hiddenIntentional — content is lost
```
GOOD:
```json
{ "breakpointVisibility": { "mobile": { "hidden": true, "disclosureTarget": "filter-btn" } } }
```

### URS004 — nav-mode-declared
When `spec.navigation` is declared, every breakpoint must have a corresponding entry in `navigation.breakpoints` with a valid `navMode`.

Valid navModes: `topbar`, `sidebar`, `hamburger`, `tabs`, `bottom-bar`

BAD:
```json
{ "navigation": { "breakpoints": { "desktop": { "navMode": "sidebar" } } } }
// "mobile" and "tablet" breakpoints have no navMode entry
```
GOOD:
```json
{ "navigation": { "breakpoints": {
  "mobile": { "navMode": "hamburger" },
  "tablet": { "navMode": "tabs" },
  "desktop": { "navMode": "sidebar" }
} } }
```

### URS005 — no-breakpoint-conflicts
No two breakpoints may share the same `minWidth`. Duplicate breakpoint boundaries create undefined responsive behavior.

BAD:
```json
{ "breakpoints": [
  { "name": "tablet-sm", "minWidth": 768 },
  { "name": "tablet-lg", "minWidth": 768 }
] }
```
GOOD: each breakpoint has a unique `minWidth`.

### URS006 — hierarchy-collapse
Any region in `spec.collapsibleRegions` must declare:
- `collapsedAt` — non-empty array of breakpoint names
- `collapseType` — one of: `"accordion"`, `"drawer"`, `"hidden"`, `"tab"`

BAD:
```json
{ "id": "sidebar", "collapsedAt": ["mobile"] }
// No collapseType
```
GOOD:
```json
{ "id": "sidebar", "collapsedAt": ["mobile"], "collapseType": "drawer" }
```

### URS007 — contract-responsive-structure
Final contract check:
- `version` declared
- All breakpoint `name` values are unique
- Breakpoints are sorted by `minWidth` ascending

BAD: breakpoints listed as desktop (1280), then mobile (0) — wrong order.
GOOD: breakpoints sorted 0 → 768 → 1280.

---

## What This Compiler Never Forgives

- `responsive-spec.json` missing — gate skipped (soft, not hard-fail)
- Breakpoints array missing `"mobile"` or `"desktop"` named entry (URS001)
- Missing mobile (≤480), tablet (481–1023), or desktop (≥1024) tier (URS002)
- Hidden region without `disclosureTarget` or `hiddenIntentional:true` (URS003)
- Navigation breakpoint missing `navMode` (URS004)
- Invalid `navMode` value (URS004)
- Two breakpoints with same `minWidth` (URS005)
- Collapsible region without `collapsedAt` or `collapseType` (URS006)
- Invalid `collapseType` (URS006)
- Duplicate breakpoint names (URS007)
- Breakpoints not sorted ascending by `minWidth` (URS007)
- `version` missing (URS007)
