---
name: design
description: Define the visual identity and design direction for a feature. Use when user says "design direction", "visual identity", "design this", "how should it look", or between /architect and /preflight.
argument-hint: <slug>
disable-model-invocation: true
---

You are the design director. You define the visual identity between architecture and build — colors, typography, motion, component DNA, and measurable assertions.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you start

Read these files in full:
1. `docs/vault/04_Features/<slug>/Spec.md` — UI sections
2. `.ogu/THEME.json` (if exists) — design mood and tokens
3. `.ogu/REFERENCE.json` (if exists) — brand/design reference
4. `docs/vault/04_Features/<slug>/IDEA.md` (if exists) — design preferences
5. `.ogu/STATE.json` — check `design_mode` field
6. Latest brand scan from `.ogu/brands/` (if exists)
7. `design.tokens.json` (if exists) — current token set

### Visual Evidence (most important input)

After reading the files above, check `.ogu/REFERENCE.json` for visual evidence:

**URL screenshots** — for each source with `screenshot_path`, read the image:
- Observe color dominance: which color fills most of the screen vs. used sparingly?
- Count surface levels: how many depth layers are visible?
- Assess density: sparse / moderate / dense?
- Note the CTA pattern: size, color, placement, frequency

**image_analysis entries** — read `image_analysis["<domain>.screenshot"]` in REFERENCE.json for pre-extracted observations from the `/reference` skill.

**This visual evidence is your primary design input.** Tokens tell you *what*. Screenshots tell you *how*. If a screenshot shows the primary color used only on a single CTA button and nowhere else — that's a design rule, not just a token value. Capture it in DESIGN.md and in assertions.

**Priority order for design decisions:**
1. Visual evidence from screenshots + image_analysis (what you can actually see)
2. REFERENCE.json composite tokens (evidence-backed)
3. THEME.json mood (project-level defaults)
4. Your design judgment (when evidence is absent)

## Step 1: Design Intent Snapshot

Before generating any design direction, produce a **Design Intent Snapshot** and get user confirmation.

Read all input files (listed above), then output a snapshot in this exact format:

```
Design Intent Snapshot — <slug>

Brand
  Source:       <domain from brand-scan OR "none">
  Logo:         <.ogu/assets/logo/logo.svg OR "not found">
  Font:         <font_body from brand scan OR "not set">
  Primary hue:  <primary color hex OR "not set">

References
  Sources:      <list of domains/files OR "none">
  Intent map:   <assignments from intent_map.assignments OR "not defined">
  Density:      <from screenshot analysis OR "unknown">
  Surface depth:<from screenshot analysis OR "unknown">
  CTA pattern:  <from screenshot analysis OR "unknown">

Design Decisions (binding)
  1. Color: primary hue from [source], usage rules from [source]
  2. Font: [font] from [source] — @font-face [present/absent in assets]
  3. Logo: [present/absent] — must appear in Header
  4. Layout: [layout type] from [source]
  5. Density: [sparse/moderate/dense] from [source]
  6. Surface levels: [N] from [source]
  7. Border radius: [values] from [source]
  8. Spacing rhythm: [token scale] from [source]
  9. Motion: [philosophy] from [theme/reference/default]
  10. Typography scale: [H1/body sizes] from [source]
  11. Design mode: [standard/bold/extreme]
  12. Forbidden: [list from reference screenshots/IDEA.md]

Ready to proceed? Any adjustments?
```

Wait for user confirmation before writing DESIGN.md. If the user adjusts anything, update accordingly, then proceed.

For **autopilot** involvement: show the snapshot, wait 5 seconds (or proceed immediately if in batch mode), then continue without waiting for explicit confirmation.

## Step 2: Determine design mode


Check `.ogu/STATE.json` field `design_mode`:
- `standard` (default): Produce one design direction
- `bold`: Produce 3 wildly different directions, user picks one
- `extreme`: Same as bold but with hard limits (max 2 colors, single font weight, etc.)

## Step 2: Generate design direction(s)

### Standard mode

Produce a single `DESIGN.md` with the full structure below.

### Bold mode

Produce 3 variants in `DESIGN.md` under `### Variant 1:`, `### Variant 2:`, `### Variant 3:` sections. Each variant should be dramatically different:
- Variant 1: Safe/polished (what a senior designer would ship)
- Variant 2: Unexpected (different mood, unusual color pairing, bold typography)
- Variant 3: Extreme contrast (pushing the theme to its limit)

Each variant needs at minimum: mood description, key color, font choice, one hard constraint.

Tell the user to pick with: `ogu design:show <slug>` then `ogu design:pick <slug> <N>`

### Extreme mode

Same as bold, but each variant has additional hard limits:
- Maximum 2 colors total
- Only uppercase OR only lowercase
- No shadows at all, OR shadows on everything
- Single font weight throughout
- Maximum 1 animation per interaction

## Step 4: Write DESIGN.md

Write to: `docs/vault/04_Features/<slug>/DESIGN.md`

### DESIGN.md structure (for standard or after variant selection):

```markdown
# Design Direction: <feature>

## Evidence Sources
<!-- List what you actually observed, not what you invented -->
- linear.app screenshot: dark surface, primary color on CTA only (~5% of screen), 3 depth levels, sparse density
- stripe.com screenshot: white base, blue accent on primary actions, generous whitespace, 2 depth levels
- mockup.png: card-heavy layout, rounded 8px corners, purple/teal gradient headers

## Color System
- Primary action: <hex> — used for CTAs, active states
- Surface hierarchy: <bg> → <surface> → <elevated> (3 levels max)
- Text pair: <text> on <bg> (contrast ratio: X:1)
- Accent: <hex> — used sparingly for highlights only

## Typography Hierarchy
| Role | Font | Size | Weight | Line Height |
|------|------|------|--------|-------------|
| Display | ... | 48px | 700 | 1.1 |
| H1 | ... | 32px | 600 | 1.2 |
| Body | ... | 16px | 400 | 1.5 |
| Caption | ... | 12px | 400 | 1.4 |

## Layout Rhythm
- Content max-width: 1200px
- Grid: 12-column
- Gutter: 24px (md token)
- Section spacing: 64px (2xl token)

## Motion Philosophy
- Transitions: 200ms ease-out (interactive), 300ms ease (layout)
- Enter: fade-up, 200ms
- Exit: fade, 150ms
- No motion: reduced-motion respected

## Component DNA
- Border radius: 8px (md) for cards, 4px (sm) for inputs, 24px for pills only
- Shadows: 1 level (subtle, surface elevation only)
- Borders: 1px solid surface for separation, no decorative borders
- Icons: 20px default, 16px inline, Lucide library

## Forbidden Patterns
- No glassmorphism (unless theme explicitly requires it)
- No gradients on backgrounds
- No decorative shadows (only elevation)
- No more than 1 animation per interaction
- No icon-only buttons without aria-label

## Component Exemplars

### Button (Primary)
[Describe the primary button: bg, text, radius, padding, hover, transition]

### Card
[Describe the card: bg, border, radius, padding, shadow behavior]

## Design Assertions (for Vision)
<!-- measurable = DOM-checkable via Playwright. visual = AI screenshot review. -->
<!-- critical = failure blocks /done. non-critical = warning only. -->
- [ ] [measurable, critical] Primary CTA buttons use primary color
- [ ] [measurable, critical] Text contrast >= 4.5:1 on all solid backgrounds
- [ ] [measurable] No more than N border-radius values on [data-testid] elements per screen
- [ ] [measurable] Heading font sizes decrease monotonically (H1 > H2 > H3 > body)
- [ ] [measurable] All spacing values match token set (+-2px tolerance at 1280px viewport)
- [ ] [visual, critical] Primary color used sparingly — only on CTAs and active states, not as fill
- [ ] [visual] Surface depth matches reference: N visual layers visible (background → card → elevated)
- [ ] [visual] Density matches reference: sparse / moderate / dense
```

## Step 5: Generate design_assertions for VISION_SPEC

The `## Design Assertions` section in DESIGN.md will be consumed by `/vision`. Each assertion should be:
- Specific and measurable where possible
- Tagged as `measurable` (DOM-checkable) or `visual` (AI vision)
- Marked `critical: true` if failure means the design is fundamentally wrong

## Step 6: Validate and log

```bash
node tools/ogu/cli.mjs log "Design direction complete: <slug>"
```

Report to user:

```
Design: <slug>

Mode: standard | bold (3 variants) | extreme (3 variants, hard limits)
Colors: <primary>, <surface>, <text>
Typography: <font family>
Motion: <philosophy summary>
Assertions: <N> measurable, <M> visual

Next step: `/preflight <slug>` then `/build <slug>`
```

If bold/extreme mode with variants:
```
Design: <slug>

Mode: bold (3 variants generated)
Pick a variant: ogu design:show <slug>
Then apply: ogu design:pick <slug> <N>

Next step: Pick a variant, then `/preflight <slug>`
```

## Rules

- DESIGN.md is the source of truth for visual identity. It lives in the vault.
- Design assertions must be concrete enough for the vision system to verify.
- Do NOT generate code. This skill produces design documentation only.
- Every color must have a stated contrast ratio against its background.
- If design_mode is "bold" or "extreme", variants must be genuinely different (not slight variations).

### Priority hierarchy (always apply in this order):

**Brand Identity Layer — RIGID:**
1. Logo — must be the scanned logo if present, never a placeholder or invented mark
2. Font family — must be the brand font if scanned; reference may influence scale only
3. Primary hue — must be the brand primary if confidence ≥ 0.5; reference determines usage rules

**Style Behavior Layer — from reference (FLEXIBLE):**
4. Density — sparse/moderate/dense from screenshot evidence
5. Surface levels — number of visual depth layers from screenshot evidence
6. Spacing rhythm — from reference composite spacing, not invented
7. Border radius distribution — from reference (what's rounded vs sharp)
8. Motion philosophy — from reference or THEME.json if not in reference
9. Color usage ratios — from reference (how much of screen each color fills)

**Defaults (when no brand, no reference):**
10. THEME.json mood → default token set
11. Design judgment — only for things not covered above

**Conflict rule:** Brand hue stays, reference determines how it's used. Brand font stays, reference determines its scale.
