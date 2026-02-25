---
name: vision
description: Full visual verification of UI against spec — DOM assertions, screenshot diff, and AI vision analysis. Use when user says "check visuals", "does it look right", "vision check", "verify UI", or after /build.
argument-hint: <slug>
disable-model-invocation: true
---

You are the visual verification engine. You prove the UI looks right, not just that the code compiles.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you start

1. Confirm preview is running. Check if `http://localhost:3000` is reachable. If not:
   ```bash
   node tools/ogu/cli.mjs preview
   ```

2. Read these files:
   - `docs/vault/04_Features/<slug>/Spec.md` — the visual spec
   - `.ogu/vision/<slug>/VISION_SPEC.json` — the machine-readable spec (if exists)

## Step 1: Run CLI vision command

```bash
node tools/ogu/cli.mjs vision <slug>
```

This runs:
- **Tier 1**: DOM assertions (selectors, text, layout) via Playwright
- **Tier 2**: Screenshot capture (saved to `.ogu/vision/<slug>/current/`)

Check the output. If Tier 1 fails, report failures and stop.

## Step 2: Baseline check

If baselines don't exist yet:
```bash
node tools/ogu/cli.mjs vision baseline record <slug>
```

Tell the user: "First baselines recorded. These are the reference screenshots. Future runs will compare against them."

If baselines exist, compare current screenshots against baselines visually.

## Step 2.5: Check Design Assertions

Read `docs/vault/04_Features/<slug>/DESIGN.md` if it exists. Extract the `## Design Assertions` section. These become structured checks for each screen.

If DESIGN.md doesn't exist, skip this step.

## Step 3: AI Vision verification (Tier 3)

This is the critical step. For each screen:

1. **Read the screenshot image** from `.ogu/vision/<slug>/current/<screen-name>-loaded.png`
2. **Read the Spec.md section** for that screen
3. **Read DESIGN.md** for design assertions specific to this screen
4. **Answer measurable assertions** (DOM-based, at 1280x720 viewport):
   - Text contrast >= 4.5:1 on solid backgrounds → extract `color` and `backgroundColor` from `[data-testid]` elements
   - Border-radius count → count unique `borderRadius` values on `[data-testid]` elements (ignore 0px)
   - Typography hierarchy → verify `fontSize` descends: H1 > H2 > H3 > body
   - Spacing from tokens → compare `margin`, `padding` to token values (±2px tolerance)

5. **Answer visual assertions** (AI vision with boolean YES/NO):
   For each `visual` type assertion in DESIGN.md, ask a specific boolean question:
   - "Is the primary CTA button using the primary color (#hex)? PASS or FAIL."
   - "Does the overall mood match the theme? PASS or FAIL."
   Do NOT use open-ended "does it look good?" — every question must have a concrete PASS/FAIL answer.

6. **Rate each screen**: PASS / WARN / FAIL
   - PASS: All critical assertions pass, non-critical pass rate >= 80%
   - WARN: All critical pass but non-critical rate < 80%
   - FAIL: ANY critical assertion fails

**Critical vs non-critical assertions:**
- `critical: true` in DESIGN.md → must pass (100% required)
- `critical: false` → contributes to pass rate (>= 80% threshold)
- Gate 9 fails if ANY critical assertion fails OR non-critical pass rate < 80%

## Step 4: Update Vision Report

Update `.ogu/vision/<slug>/VISION_REPORT.md` with results including design assertions:

For each screen, add a design assertions table:
```markdown
## Design Assertions: <screen>
| ID | Rule | Type | Result | Details |
|----|------|------|--------|---------|
| contrast | Text contrast >= 4.5:1 | measurable | PASS | Min ratio: 5.2:1 |
| radius-count | Max 2 border-radius values | measurable | PASS | Found: 4px, 8px |
| heading-hierarchy | H1 > H2 > H3 > body | measurable | FAIL | H2 (18px) < H3 (20px) |
| primary-cta | Primary buttons use primary | visual | PASS | Confirmed via AI vision |

Critical: 2/3 PASS
Non-critical: 1/2 PASS (50%)
Screen result: FAIL (critical heading-hierarchy failed)
```

Also include the Tier 3 AI Vision section:
```
**Tier 3 — AI Vision:** PASS/WARN/FAIL

  Analysis:
  - [observation 1]
  - [observation 2]

  Issues found:
  - [issue 1] (severity: high/medium/low)
```

## Step 5: Log result

```bash
node tools/ogu/cli.mjs log "Vision check <PASS/WARN/FAIL>: <slug> (<N> screens, <issues> issues)"
```

## Output

```
Vision Verification: <slug>

  Tier 1 (DOM):        <N>/<total> PASS
  Tier 2 (Screenshot): <N>/<total> captured
  Tier 3 (AI Vision):  <N>/<total> PASS, <W> WARN, <F> FAIL

  Screens:
    [1] Dashboard (loaded)  — PASS
    [2] Dashboard (empty)   — PASS
    [3] Settings            — WARN (sidebar slightly off)
    [4] Profile             — FAIL (missing avatar, broken layout)

  Issues:
    - [HIGH] Profile: avatar component not rendering
    - [MED]  Settings: sidebar 10px wider than spec

  Overall: PASS / WARN / FAIL
```

If FAIL → report the specific issues and what needs fixing.
If WARN → report warnings but note the feature can proceed with known issues.
If PASS → all visual checks passed.

## Rules

- All 3 tiers must run. DOM alone is not enough. Screenshots alone are not enough.
- AI Vision is the final arbiter for "does it look right to a human?"
- Do NOT approve a screen that has major visual issues just because the DOM assertions pass.
- If Playwright is not installed, tell the user to install it. Do not skip visual verification.
- If preview is not running, start it. Do not skip visual verification.
- Baselines must exist for Tier 2 comparison. If they don't, record them first.
- This skill verifies and reports. It does NOT fix visual issues.
