// Apply a chosen design variant and amplify it.
// Usage: ogu design:pick <slug> <variant-number>

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

export async function designPick() {
  const args = process.argv.slice(3);
  const slug = args[0];
  const variantNum = parseInt(args[1], 10);

  if (!slug || !variantNum || isNaN(variantNum)) {
    console.error("Usage: ogu design:pick <slug> <variant-number>");
    return 1;
  }

  const root = repoRoot();
  const designPath = join(root, `docs/vault/04_Features/${slug}/DESIGN.md`);

  if (!existsSync(designPath)) {
    console.error(`  ERROR  DESIGN.md not found for feature "${slug}"`);
    return 1;
  }

  const content = readFileSync(designPath, "utf-8");

  // Find the variant section
  const variantRegex = new RegExp(`###\\s*Variant\\s*${variantNum}[:\\s]*([\\s\\S]*?)(?=###\\s*Variant\\s*\\d|$)`);
  const match = content.match(variantRegex);

  if (!match) {
    console.error(`  ERROR  Variant ${variantNum} not found in DESIGN.md`);
    console.error("  hint   Run: ogu design:show <slug> to see available variants");
    return 1;
  }

  // Extract the variant content and promote it to the main DESIGN.md
  const variantContent = match[1].trim();

  // Build the new DESIGN.md with the selected variant as the main content
  // Keep the header, add variant marker, then the variant's content
  const headerMatch = content.match(/^# Design Direction:.*\n/);
  const header = headerMatch ? headerMatch[0] : `# Design Direction: ${slug}\n`;

  const newContent = `${header}
**Variant:** ${variantNum} (amplified)
**Selected:** ${new Date().toISOString().split("T")[0]}

${variantContent}

---

## Original Variants

${content.replace(header, "").trim()}
`;

  writeFileSync(designPath, newContent, "utf-8");

  console.log(`  picked   Variant ${variantNum} selected and amplified for "${slug}"`);
  console.log(`  file     docs/vault/04_Features/${slug}/DESIGN.md`);
  console.log("  hint     The /build skill will use this design direction.");

  return 0;
}
