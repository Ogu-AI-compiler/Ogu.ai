// Show design variant summaries for quick selection.
// Usage: ogu design:show <slug>

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

export async function designShow() {
  const slug = process.argv[3];
  if (!slug) {
    console.error("Usage: ogu design:show <slug>");
    return 1;
  }

  const root = repoRoot();
  const designPath = join(root, `docs/vault/04_Features/${slug}/DESIGN.md`);

  if (!existsSync(designPath)) {
    console.error(`  ERROR  DESIGN.md not found for feature "${slug}"`);
    console.error("  hint   Run /design first to generate design directions.");
    return 1;
  }

  const content = readFileSync(designPath, "utf-8");

  // Check if this is a multi-variant DESIGN.md
  const variants = parseVariants(content);

  if (variants.length === 0) {
    // Single direction (standard mode)
    console.log(`\n  Design Direction: ${slug}\n`);
    console.log("  Mode: standard (single direction)");
    printDesignSummary(content);
    return 0;
  }

  // Multi-variant mode (bold/extreme)
  console.log(`\n  Design Variants: ${slug}\n`);

  const selected = content.match(/\*\*Variant:\*\*\s*(\d+)/);
  if (selected) {
    console.log(`  Selected: Variant ${selected[1]} (amplified)\n`);
  } else {
    console.log("  No variant selected yet. Use: ogu design:pick <slug> <1|2|3>\n");
  }

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    console.log(`  [${i + 1}] ${v.mood}`);
    console.log(`      Color: ${v.color} | Font: ${v.font} | Constraint: ${v.constraint}`);
    console.log("");
  }

  return 0;
}

function parseVariants(content) {
  const variants = [];
  // Look for "### Variant N:" sections
  const variantRegex = /###\s*Variant\s*(\d+)[:\s]*(.+?)(?=###\s*Variant|\n## |$)/gs;
  let match;

  while ((match = variantRegex.exec(content)) !== null) {
    const section = match[2];
    const mood = extractField(section, "mood") || extractFirstLine(section);
    const color = extractField(section, "primary|color|accent") || "not specified";
    const font = extractField(section, "font|typography") || "not specified";
    const constraint = extractField(section, "constraint|limit|restriction") || "none";

    variants.push({ num: parseInt(match[1], 10), mood, color, font, constraint });
  }

  return variants;
}

function extractField(text, pattern) {
  const regex = new RegExp(`(?:${pattern})\\s*[:\\-]\\s*(.+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim().slice(0, 60) : null;
}

function extractFirstLine(text) {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  return lines[0]?.trim().slice(0, 60) || "unnamed";
}

function printDesignSummary(content) {
  // Extract key sections
  const colorMatch = content.match(/## Color System\n([\s\S]*?)(?=\n## )/);
  const typoMatch = content.match(/## Typography Hierarchy\n([\s\S]*?)(?=\n## )/);
  const motionMatch = content.match(/## Motion Philosophy\n([\s\S]*?)(?=\n## )/);

  if (colorMatch) {
    const primaryLine = colorMatch[1].match(/Primary[^:]*:\s*(.+)/i);
    if (primaryLine) console.log(`  Color: ${primaryLine[1].trim().slice(0, 60)}`);
  }
  if (typoMatch) {
    const displayLine = typoMatch[1].match(/Display[^|]*\|([^|]+)/i);
    if (displayLine) console.log(`  Display font: ${displayLine[1].trim()}`);
  }
  if (motionMatch) {
    const transLine = motionMatch[1].match(/Transitions?:\s*(.+)/i);
    if (transLine) console.log(`  Motion: ${transLine[1].trim().slice(0, 60)}`);
  }
}
