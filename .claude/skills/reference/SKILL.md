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

### 5. Present findings
Read `.ogu/REFERENCE.json` and present:

- **Per-source highlights**: "From Linear: dark mode + purple accent. From mockup.png: clean card layout with generous spacing."
- **Composite direction**: Show the merged result — colors, fonts, spacing, mood
- **Key decisions**: Where did each element come from?

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

## Tips
- This is different from `brand-scan` — brand-scan extracts YOUR brand. Reference composites INSPIRATION from others.
- The composite is a starting point. The user's feedback refines it.
- Focus on the FEEL, not just the numbers. "Linear's focused, dark aesthetic meets Stripe's clean typography."
- When analyzing images, describe what you SEE — don't guess. If you can't tell the font, say "appears sans-serif" not "Inter".
- PDFs often contain multiple screens/pages. Analyze each page and note which page each insight comes from.
