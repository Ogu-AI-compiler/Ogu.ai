import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { templates } from "../templates.mjs";
import { repoRoot } from "../util.mjs";

export async function init() {
  const root = repoRoot();
  let created = 0;
  let skipped = 0;

  for (const [relPath, content] of Object.entries(templates)) {
    const fullPath = join(root, relPath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(fullPath)) {
      skipped++;
    } else {
      writeFileSync(fullPath, content, "utf-8");
      console.log(`  created  ${relPath}`);
      created++;
    }
  }

  console.log("");
  console.log(`Ogu init complete: ${created} files created, ${skipped} already existed.`);
  return 0;
}
