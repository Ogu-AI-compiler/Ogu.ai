---
name: reference
description: Build a composite design direction from inspiration/competitor websites, images, and PDFs. Use when user says "I want it to look like...", "references", "inspiration", provides competitor URLs, or shares design mockups/screenshots.
argument-hint: [url1 url2 file1.png file2.pdf ...]
disable-model-invocation: true
---

# Reference — Composite Design Direction

You help the user build a unified design direction from inspiration sources: websites, images, and PDFs.

## Flow

### 1. Collect References
If inputs were provided as arguments, proceed directly to step 3.

If no inputs provided, ask conversationally (one question at a time):

**First:** "What inspires the look you want? Share 2-5 sources — URLs, screenshots, mockups, or design PDFs."

**For each source** (optional, helps weight the composite):
"What do you like about this one? (e.g., dark mode, typography, spacing, colors)"

### 2. Validate
- Need at least 2 inputs total (any mix of URLs + files)
- URLs must be valid HTTP/HTTPS
- Files must be PNG, JPG, JPEG, WEBP, or PDF
- Maximum 7 inputs total

### 3. Run the CLI
```bash
node tools/ogu/cli.mjs reference <url1> <url2> <file1.png> [more...] --apply --soul
```

This will:
- Scan each URL for colors, fonts, spacing, effects, tone
- **Capture a 1280×720 screenshot of each URL** (if Playwright is available) — stored in `.ogu/references/screenshots/<domain>.png` and referenced in REFERENCE.json as `screenshot_path`
- Copy images/PDFs to `.ogu/references/`
- Composite URL-based scans into a merged design direction
- Save to `.ogu/REFERENCE.json`
- Apply URL-based composite as THEME.json (if URLs present)
- Update SOUL.md

### 4. Analyze Images and PDFs
After the CLI runs, check `.ogu/REFERENCE.json` for image/PDF sources.

**For each image source** (type = "image"):
1. Read the image file at `<project_root>/<source.path>` using the Read tool
2. Analyze what you see and extract:
   - **Dominant colors**: List 3-5 hex color values (primary, secondary, background, text, accent)
   - **Typography feel**: serif/sans-serif/mono, weight impression (light/regular/bold), style (modern/classic/playful)
   - **Mood**: dark/light, minimal/busy, playful/serious, warm/cool
   - **Spacing**: tight/moderate/generous
   - **Design patterns**: cards, gradients, shadows, rounded corners, borders, glass effects
   - **Layout**: grid-based, asymmetric, centered, sidebar, full-bleed

**For each PDF source** (type = "pdf"):
1. Read the PDF file using the Read tool with `pages: "1-5"` (max 5 pages)
2. Analyze each page the same way as images above

**Write analysis to REFERENCE.json:**
Read the current `.ogu/REFERENCE.json`, then update the `image_analysis` field:
```json
{
  "image_analysis": {
    "mockup.png": {
      "colors": { "primary": "#...", "secondary": "#...", "background": "#...", "text": "#...", "accent": "#..." },
      "typography_feel": "sans-serif, light weight, modern",
      "mood": ["dark", "minimal", "developer-focused"],
      "spacing": "generous",
      "patterns": ["rounded corners", "subtle shadows", "glass effects"],
      "layout": "centered with sidebar",
      "notes": "Clean SaaS dashboard with purple accent on dark background"
    }
  }
}
```

### 4b. Analyze URL Screenshots (Visual Evidence)
After step 4, check `.ogu/REFERENCE.json` for URL sources that have a `screenshot_path` field.

**For each URL source** (type = "url") where `screenshot_path` is present:
1. Read the screenshot at `<project_root>/<source.screenshot_path>` using the Read tool
2. Analyze the same fields as images (dominant colors, typography feel, mood, spacing, patterns, layout)
3. Pay special attention to:
   - **Color dominance**: how much of the screen is each color? Is the primary color used sparingly (CTAs only) or everywhere?
   - **Surface depth**: how many visual layers exist? (e.g., background → card → elevated card = 3 levels)
   - **Component density**: sparse / moderate / dense — elements per viewport
   - **CTA pattern**: what does the primary action look like? Size, color, placement
4. Write analysis to REFERENCE.json under:
   ```json
   "image_analysis": {
     "<domain>.screenshot": {
       "colors": { "primary": "#...", ... },
       "typography_feel": "...",
       "mood": [...],
       "spacing": "...",
       "patterns": [...],
       "layout": "...",
       "color_dominance": "primary used sparingly on CTAs only (~5% of screen area)",
       "surface_levels": 3,
       "density": "sparse",
       "cta_pattern": "solid primary-color pill button, single per screen",
       "notes": "..."
     }
   }
   ```

This screenshot evidence is the primary input for `/design`. It tells Ogu *how* tokens are used, not just *what* they are.

**Merge into composite:**
After analyzing all images, update the composite in REFERENCE.json:
- If image colors differ from URL-composite, note the contrast and prefer image colors for visual roles (primary, accent)
- If mood signals from images differ from URL tone markers, union them
- Typography feel from images can override URL-detected fonts if the image analysis is more specific

If there were no URL sources (images/PDFs only), build the composite entirely from image analysis.

If `--apply` was deferred (no URLs), now apply to THEME.json:
```bash
node tools/ogu/cli.mjs theme set <detected-mood>
```

### 4c. Intent Map (when sources are divergent)
After step 4b, check `.ogu/REFERENCE.json` field `intent_map.divergent`.

If `divergent: true`, the CLI detected sources that disagree significantly on certain color roles. Before merging, ask the user:

"Your sources have different approaches — let me map what to take from each. Looking at [source1] and [source2]:
- [source1] has [dark/dense/minimal/etc] aesthetic
- [source2] has [light/spacious/bold/etc] aesthetic

What should each source contribute?"

Present a quick table with one row per source, with examples:
| Source | Best for |
|--------|----------|
| linear.app | layout rhythm, density |
| stripe.com | typography scale, whitespace |
| mockup.png | color palette, surface depth |

User selects what each source contributes. Write this to REFERENCE.json:
```json
"intent_map": {
  "divergent": true,
  "assignments": {
    "layout": "linear.app",
    "typography": "stripe.com",
    "colors": "mockup.png",
    "motion": "linear.app"
  }
}
```

If `divergent: false`, skip this step — the composite is already well-defined.

### 5. Present findings + Merge Report
Read `.ogu/REFERENCE.json` and present:

- **Per-source highlights**: "From Linear: dark mode + purple accent. From mockup.png: clean card layout with generous spacing."
- **Composite direction**: Show the merged result — colors, fonts, spacing, mood
- **Merge Report**: Show where each decision came from, using `merge_report` in REFERENCE.json:
  ```
  Decision               Value         Source           Confidence
  ─────────────────────────────────────────────────────────────────
  Primary color          #5e6ad2       linear.app       0.85 (base)
  Background             #0f0f0f       linear.app       1.00 (base)
  Body font              Inter         linear.app       —
  Density                sparse        linear.app screenshot
  Surface levels         3             linear.app screenshot
  CTA pattern            pill, rare    linear.app screenshot
  ```
  This transparency lets the user understand and correct any decision quickly.

### 6. Ask for adjustments
"Does this capture the direction you want? Anything to adjust?"

If the user wants changes:
- "More of [site]'s dark feel" → Re-weight dark mode + that site's palette
- "I like the colors from the mockup more" → Re-weight toward image analysis colors
- "Different font" → Show detected/analyzed fonts, let user pick, update
- "Warmer colors" / "Cooler tones" → Adjust composite accordingly

Save any adjustments back to `.ogu/REFERENCE.json` and reapply to THEME.json if needed.

### 7. Log
```bash
node tools/ogu/cli.mjs log "Design references set: <source1>, <source2>, ..."
```

## Subcommands

Show current reference:
```bash
node tools/ogu/cli.mjs reference show
```

Clear reference:
```bash
node tools/ogu/cli.mjs reference clear
```

## Priority Hierarchy

When Brand DNA (from brand-scan) and Reference data conflict, apply these rules:

### Brand Identity Layer — RIGID (never override)
- Logo — always from brand-scan, never substituted
- Font family — always from brand-scan if scanned, reference may influence scale/weights only
- Primary hue — always from brand-scan if confidence ≥ 0.5

### Style Behavior Layer — FLEXIBLE (reference wins)
- Density (sparse/moderate/dense)
- Spacing rhythm and token scale
- Surface levels (how many depth layers)
- Shadow style and usage
- Motion philosophy and animation timing
- Color usage ratios (how much of the screen each color fills)

### Conflict resolution rules:
- **Color conflict**: Brand hue stays, reference determines usage behavior ("use primary only on CTAs")
- **Font conflict**: Brand family stays, reference determines scale (if Stripe uses tighter type scale, apply that)
- **No brand scanned**: Reference wins on everything
- **No reference**: Brand wins on identity, THEME.json defaults win on behavior

## Tips
- This is different from `brand-scan` — brand-scan extracts YOUR brand. Reference composites INSPIRATION from others.
- The composite is a starting point. The user's feedback refines it.
- Focus on the FEEL, not just the numbers. "Linear's focused, dark aesthetic meets Stripe's clean typography."
- When analyzing images, describe what you SEE — don't guess. If you can't tell the font, say "appears sans-serif" not "Inter".
- PDFs often contain multiple screens/pages. Analyze each page and note which page each insight comes from.
