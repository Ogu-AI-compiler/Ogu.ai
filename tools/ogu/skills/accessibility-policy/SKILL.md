---
name: accessibility-policy
description: Compiler skill for the accessibility-policy compiler. Activates when producing accessibility-policy-artifact.json. Gates: QA070–QA077. No upstream dependency.
---

# accessibility-policy — Compiler Skill

## What This Compiler Does

Compiles the project-level accessibility testing policy — which tool, which WCAG version and level, how CI enforces violations, what CSS selectors are excluded, and what manual checkpoints are defined. Enforces: WCAG 2.1+ (not 2.0), Level AA minimum (not Level A), CI must fail on critical violations, excluded selectors must be ≤10 and non-broad, disabled rules must have justification, and manual checkpoints must be ≥3.

**Upstream dependency:** none
**Output artifact:** `accessibility-policy-artifact.json`
**IR identifier:** `ACCESSIBILITY_POLICY:{project}`

---

## Spec Shape

```json
{
  "tool": "axe-core",
  "wcagLevel": "AA",
  "wcagVersion": "2.2",
  "ciEnforcement": {
    "failOn": ["critical", "serious"]
  },
  "scope": {
    "pages": ["/**"],
    "components": ["src/components/**"]
  },
  "manualCheckpoints": [
    { "id": "screen-reader", "description": "Navigate entire app with NVDA (Windows) and VoiceOver (macOS)" },
    { "id": "keyboard-only", "description": "All interactions accessible via keyboard only — no mouse required" },
    { "id": "zoom-200", "description": "Content readable and functional at 200% browser zoom" },
    { "id": "reduced-motion", "description": "Animations respect prefers-reduced-motion media query" },
    { "id": "color-only", "description": "No information conveyed by color alone — icons or labels used" }
  ],
  "disabledRules": [
    {
      "ruleId": "color-contrast",
      "reason": "Third-party analytics widget from Mixpanel — vendor ticket MX-4521 open, ETA Q3 2025",
      "ticket": "https://mixpanel.com/issue/4521",
      "review": "2025-09-01"
    }
  ],
  "exclude": [".mixpanel-widget", ".third-party-chat"]
}
```

Required fields:
- `tool` — accessibility testing tool (axe-core, pa11y, lighthouse, wave, deque-axe, playwright-axe, cypress-axe, jest-axe, storybook-a11y)
- `wcagLevel` — `"A"`, `"AA"`, or `"AAA"`
- `wcagVersion` — `"2.0"`, `"2.1"`, or `"2.2"`
- `ciEnforcement` — object with `failOn`
- `scope` — at least one of: `pages`, `routes`, `components`

---

## Gates

### QA070 — spec-valid
Reads `accessibility-policy-spec.json`. Required: `tool`, `wcagLevel`, `wcagVersion`, `ciEnforcement`, `scope`.

Valid tools: `axe-core`, `pa11y`, `lighthouse`, `wave`, `deque-axe`, `playwright-axe`, `cypress-axe`, `jest-axe`, `storybook-a11y`.
Valid levels: `A`, `AA`, `AAA`.
Valid versions: `2.0`, `2.1`, `2.2`.

BAD: `"tool": "eslint-plugin-jsx-a11y"` — not a valid runtime testing tool.
GOOD: `"tool": "axe-core", "wcagLevel": "AA", "wcagVersion": "2.2"`

### QA071 — wcag-standard-current
- WCAG `2.0` — **FAIL**: outdated, missing 1.4.10 Reflow, 1.4.12 Text Spacing, mobile criteria
- WCAG `2.1` — PASS (current minimum; note: consider upgrading to 2.2)
- WCAG `2.2` — PASS (recommended, current standard)
- Level `A` — **FAIL**: insufficient for public-facing apps; missing contrast, focus visible, labels

BAD:
```json
{ "wcagVersion": "2.0", "wcagLevel": "A" }
```
GOOD:
```json
{ "wcagVersion": "2.2", "wcagLevel": "AA" }
```

### QA072 — fail-on-critical
`ciEnforcement.failOn` must include `"critical"`. Accepted shapes:
- String: `"critical"`
- Array: `["critical", "serious"]`
- Object: `{ "critical": true, "serious": false }`

BAD:
```json
{ "ciEnforcement": { "failOn": ["moderate", "minor"] } }
// critical omitted — absolute barriers don't block CI
```
GOOD:
```json
{ "ciEnforcement": { "failOn": ["critical", "serious"] } }
```

### QA073 — no-excessive-exclusions
- `spec.exclude[]` — max 10 CSS selectors
- `spec.disabledRules[]` — max 5 rule IDs
- Broad selectors blocked: `body`, `html`, `main`, `section`, `div`, `span`, `header`, `*`, short classes like `.a`

BAD:
```json
{ "exclude": ["div", "section", "main"] }
// excluding core structural elements masks real violations
```
GOOD:
```json
{ "exclude": [".mixpanel-widget", ".legacy-chat-iframe"] }
```

### QA074 — manual-checkpoints-defined
`spec.manualCheckpoints` must be an array with at least 3 entries. Each must have `id`, `name`, or `description`. Automated tools catch only ~30–40% of WCAG failures.

BAD: Missing `manualCheckpoints` entirely.
BAD: Only 2 checkpoints.
GOOD: ≥3 checkpoints covering screen reader, keyboard, zoom.

### QA075 — disabled-rules-justified
Every entry in `spec.disabledRules` must be an object (not a string) with:
- `ruleId` — string
- `reason` — string with ≥20 characters of specific explanation

BAD:
```json
{ "disabledRules": ["color-contrast"] }
// string shorthand — no justification
```
BAD:
```json
{ "disabledRules": [{ "ruleId": "color-contrast", "reason": "not needed" }] }
// reason too short (< 20 chars)
```
GOOD:
```json
{
  "disabledRules": [{
    "ruleId": "color-contrast",
    "reason": "Third-party analytics widget — vendor ticket #4521 open, ETA Q3",
    "ticket": "https://...",
    "review": "2025-09-01"
  }]
}
```

### QA076 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA077 — contract-accessibility
The compiled artifact `accessibility-policy-artifact.json` must exist with: `ir_id` (starting with `ACCESSIBILITY_POLICY:`), `tool`, `wcagVersion`, `wcagLevel`, `attestation.hash` (≥32 chars).

---

## What This Compiler Never Forgives

- `accessibility-policy-spec.json` missing (QA070 hard-fails)
- WCAG version `2.0` — outdated (QA071)
- WCAG Level `A` — insufficient (QA071)
- `ciEnforcement.failOn` not including `"critical"` (QA072)
- `ciEnforcement.failOn` empty or missing (QA072)
- More than 10 excluded selectors (QA073)
- More than 5 disabled rules (QA073)
- Broad selectors (`div`, `body`, `main`, `*`) in exclude (QA073)
- Fewer than 3 manual checkpoints (QA074)
- Disabled rules as strings without justification (QA075)
- Disabled rule `reason` shorter than 20 characters (QA075)
