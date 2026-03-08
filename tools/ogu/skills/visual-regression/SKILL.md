---
name: visual-regression
description: Compiler skill for the visual-regression compiler. Activates when producing visual-regression-artifact.json. Gates: QA060–QA066. No upstream dependency.
---

# visual-regression — Compiler Skill

## What This Compiler Does

Compiles the visual regression testing specification — tool, viewports, capture targets, diff threshold, mobile coverage, Storybook build directory, and approval workflow. Enforces: at least one mobile viewport (≤768px), `diffThreshold` between 0.001 and 0.05, `approvalWorkflow.mode` is not `"auto-approve-all"`, Storybook build directory declared when `stories` are targets, and no `none`/`skip` approval modes.

**Upstream dependency:** none
**Output artifact:** `visual-regression-artifact.json`
**IR identifier:** `VISUAL_REGRESSION:{project}`

---

## Spec Shape

```json
{
  "tool": "chromatic",
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "tablet", "width": 768, "height": 1024 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "stories": ["src/components/**/*.stories.tsx"],
  "routes": ["/", "/dashboard", "/profile"],
  "diffThreshold": 0.005,
  "storybookBuildDir": "storybook-static",
  "approvalWorkflow": {
    "mode": "pr-comment",
    "notifyOnChange": true
  }
}
```

Required fields:
- `tool` — visual testing tool (chromatic, percy, applitools, playwright-vrt, backstop, lost-pixel, reg-suit, storyshots)
- `viewports` — non-empty array, each with `name`, `width` (≥320), `height` (≥200)
- At least one of: `stories`, `routes`, `components` (non-empty)
- `diffThreshold` — declared (validated as number in gates)

---

## Gates

### QA060 — spec-valid
Reads `visual-regression-spec.json`. Required: `tool` (valid), `viewports` (non-empty, each with valid `name`/`width`/`height`), and at least one of `stories`, `routes`, or `components`.

Viewport constraints: `width ≥ 320`, `height ≥ 200`.

### QA061 — threshold-realistic
`diffThreshold` must be between 0.001 and 0.05 (0.1%–5%).

- `0` — causes constant false positives from anti-aliasing
- `< 0.001` — sub-pixel rendering differences will cause spurious failures
- `> 0.05` — 5% of pixels can change; a shifted component still passes

Recommended: 0.002–0.02 (0.2%–2%).

BAD:
```json
{ "diffThreshold": 0 }     // zero — constant false positives
{ "diffThreshold": 0.1 }   // 10% — too loose
{ "diffThreshold": 100 }   // percentage not decimal — wrong unit
```
GOOD:
```json
{ "diffThreshold": 0.005 }  // 0.5% — reasonable
```

### QA062 — mobile-viewport-present
At least one viewport must have `width ≤ 768px`. Desktop-only testing misses entire categories of mobile layout bugs (flexbox wrapping, hamburger menus, touch targets).

BAD:
```json
{ "viewports": [
  { "name": "desktop", "width": 1440, "height": 900 },
  { "name": "laptop", "width": 1024, "height": 768 }
] }
// No mobile viewport
```
GOOD:
```json
{ "viewports": [
  { "name": "mobile", "width": 375, "height": 812 },
  { "name": "desktop", "width": 1440, "height": 900 }
] }
```

### QA063 — approval-workflow-defined
`spec.approvalWorkflow` must be declared with a valid `mode`. Forbidden modes: `auto-approve-all`, `skip`, `none`, `ignore` (make VRT a no-op).

Valid modes: `manual`, `pr-comment`, `auto-approve-non-critical`, `external`, `chromatic-ui`, `percy-dashboard`.

`auto-approve-non-critical` also requires `autoApproveConditions` to be declared.

BAD:
```json
{ "approvalWorkflow": { "mode": "auto-approve-all" } }
// auto-approves everything — defeats the purpose
```
GOOD:
```json
{ "approvalWorkflow": { "mode": "pr-comment", "notifyOnChange": true } }
```

### QA064 — storybook-build-dir-declared
Skipped if `spec.stories` is not declared or empty. When stories are capture targets, `spec.storybookBuildDir` must be declared (relative path, not absolute).

BAD: `spec.stories` non-empty but `storybookBuildDir` missing.
BAD: `"storybookBuildDir": "/Users/me/project/storybook-static"` — absolute path.
GOOD:
```json
{ "storybookBuildDir": "storybook-static" }
```

### QA065 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA066 — contract-visual
The compiled artifact `visual-regression-artifact.json` must exist with: `ir_id` (starting `VISUAL_REGRESSION:`), `tool`, `viewports` (non-empty array), `diffThreshold` (number), `attestation.hash`.

---

## What This Compiler Never Forgives

- `visual-regression-spec.json` missing (QA060 hard-fails)
- Tool not in valid list (QA060)
- Any viewport with `width < 320` or `height < 200` (QA060)
- No capture targets (`stories`, `routes`, or `components`) (QA060)
- `diffThreshold: 0` — constant false positives (QA061)
- `diffThreshold > 0.05` — too loose (QA061)
- No mobile viewport (width ≤ 768px) declared (QA062)
- `approvalWorkflow` missing (QA063)
- `approvalWorkflow.mode: "auto-approve-all"` or `"skip"` or `"none"` (QA063)
- `spec.stories` non-empty but `storybookBuildDir` not declared (QA064)
- `storybookBuildDir` is an absolute path (QA064)
