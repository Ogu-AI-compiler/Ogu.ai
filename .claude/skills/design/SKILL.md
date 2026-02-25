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

## Step 1: Determine design mode

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

## Step 3: Write DESIGN.md

Write to: `docs/vault/04_Features/<slug>/DESIGN.md`

### DESIGN.md structure (for standard or after variant selection):

```markdown
# Design Direction: <feature>

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
- [ ] Primary CTA buttons use primary color
- [ ] Text contrast >= 4.5:1 on all solid backgrounds
- [ ] No more than N border-radius values on [data-testid] elements per screen
- [ ] Heading font sizes decrease monotonically (H1 > H2 > H3 > body)
- [ ] All spacing values match token set (+-2px tolerance at 1280px viewport)
```

## Step 4: Generate design_assertions for VISION_SPEC

The `## Design Assertions` section in DESIGN.md will be consumed by `/vision`. Each assertion should be:
- Specific and measurable where possible
- Tagged as `measurable` (DOM-checkable) or `visual` (AI vision)
- Marked `critical: true` if failure means the design is fundamentally wrong

## Step 5: Validate and log

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
- Respect the theme mood from THEME.json. If theme says "cyberpunk", don't design corporate.
- Respect brand scan from REFERENCE.json. Use those colors/fonts as starting points.
- Do NOT generate code. This skill produces design documentation only.
- Every color must have a stated contrast ratio against its background.
- If design_mode is "bold" or "extreme", variants must be genuinely different (not slight variations).
