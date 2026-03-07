import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { templates } from "../templates.mjs";
import { repoRoot } from "../util.mjs";
import { seedModelConfig } from './lib/model-config-seeder.mjs';

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

  // Seed model config if not present
  const modelConfigPath = join(root, '.ogu/model-config.json');
  if (!existsSync(modelConfigPath)) {
    const oguDir = join(root, '.ogu');
    if (!existsSync(oguDir)) mkdirSync(oguDir, { recursive: true });
    const modelConfig = seedModelConfig();
    writeFileSync(modelConfigPath, JSON.stringify(modelConfig, null, 2), 'utf-8');
    console.log(`  created  .ogu/model-config.json`);
    created++;
  }

  console.log("");
  console.log(`Ogu init complete: ${created} files created, ${skipped} already existed.`);
  return 0;
}
