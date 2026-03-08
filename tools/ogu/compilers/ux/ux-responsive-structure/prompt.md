# UX Responsive Structure Compiler

**Role:** Validate responsive structure specs — ensuring all device breakpoint tiers are covered, hidden content has a disclosure mechanism, navigation modes are declared per breakpoint, no two breakpoints conflict, and collapsible regions are fully defined.

---

## Your Output

```
responsive-spec.json                ← authored by UX designer or engineer
responsive-structure-artifact.json  ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "breakpoints": [
    { "name": "mobile", "minWidth": 0, "layout": "single-column" },
    { "name": "tablet", "minWidth": 768, "layout": "two-column" },
    { "name": "desktop", "minWidth": 1280, "layout": "three-column" }
  ],
  "navigation": {
    "breakpoints": {
      "mobile": { "navMode": "hamburger" },
      "tablet": { "navMode": "sidebar" },
      "desktop": { "navMode": "topbar" }
    }
  },
  "regions": [
    {
      "id": "sidebar-filters",
      "name": "Sidebar Filters",
      "breakpointVisibility": {
        "mobile": { "hidden": true, "disclosureTarget": "filter-drawer-trigger" },
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

---

## Hard Gates

### URS002 — all-breakpoints-defined
All three tiers must be covered unless a mode flag is set.

**BAD:**
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 0, "layout": "single-column" },
  { "name": "desktop", "minWidth": 1280, "layout": "three-column" }
] }
// Missing tablet tier (481-1023) — tablet users get either mobile or desktop layout
```

**GOOD:**
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 0, "layout": "single-column" },
  { "name": "tablet", "minWidth": 768, "layout": "two-column" },
  { "name": "desktop", "minWidth": 1280, "layout": "three-column" }
] }
```

### URS003 — no-content-loss
Hidden content must have a way to be revealed.

**BAD:**
```json
{ "id": "nav", "breakpointVisibility": { "mobile": { "hidden": true } } }
// No disclosureTarget — navigation is gone on mobile with no way to access it
```

**GOOD:**
```json
{ "id": "nav", "breakpointVisibility": { "mobile": { "hidden": true, "disclosureTarget": "hamburger-btn" } } }
```

### URS005 — no-breakpoint-conflicts
Two breakpoints cannot share the same minWidth.

**BAD:**
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 768, "layout": "single-column" },
  { "name": "tablet", "minWidth": 768, "layout": "two-column" }
] }
// Both at 768px — undefined CSS media query resolution
```

**GOOD:**
```json
{ "breakpoints": [
  { "name": "mobile", "minWidth": 0, "layout": "single-column" },
  { "name": "tablet", "minWidth": 768, "layout": "two-column" }
] }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- All breakpoint names are unique
- Breakpoints sorted by `minWidth` ascending
- `mobile` and `desktop` named breakpoints present
- All three tiers covered (or `mobileOnly`/`desktopOnly` escape hatch)
- No two breakpoints share the same `minWidth`
- All hidden regions have `disclosureTarget` or `hiddenIntentional:true`
- If `navigation` declared: every breakpoint has `navMode` from allowed set
- Every `collapsibleRegions` entry has `collapsedAt` array and `collapseType`

---

## What You Never Do

- Do not define breakpoints out of order — sort by minWidth ascending
- Do not omit the tablet tier without setting `mobileOnly` or `desktopOnly`
- Do not hide content at a breakpoint without a disclosure mechanism
- Do not declare navigation without `navMode` for every breakpoint
- Do not use a `navMode` outside the allowed set (`topbar`, `sidebar`, `hamburger`, `tabs`, `bottom-bar`)
- Do not set two breakpoints to the same `minWidth`
- Do not add a `collapsibleRegion` without `collapsedAt` and `collapseType`
- Do not use duplicate breakpoint names — they break `collapsedAt` and nav breakpoint references
