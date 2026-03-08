/**
 * Gate: naming-valid
 * Hook file must be named use*.ts or use*.tsx.
 * Exported function must start with "use".
 * React requires this — without it, the linter cannot enforce Rules of Hooks.
 */
import { readFileSync, existsSync, readdirSync } from "fs";

export async function run({ dir }) {
  // Find the hook file
  let hookFiles;
  try {
    hookFiles = readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
  } catch {
    return { pass: false, code: "RH002", message: `Cannot read directory: ${dir}` };
  }

  if (hookFiles.length === 0) {
    return {
      pass: false,
      code: "RH002",
      message: "No hook file found — expected a file named use*.ts or use*.tsx (e.g. useUser.ts)",
    };
  }

  const violations = [];

  for (const file of hookFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");

    // Must export a function starting with "use"
    const exportedFns = [...content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+(use\w+)/g)].map(m => m[1]);
    const exportedArrows = [...content.matchAll(/export\s+const\s+(use\w+)\s*=/g)].map(m => m[1]);
    const allExported = [...exportedFns, ...exportedArrows];

    if (allExported.length === 0) {
      violations.push({ file, issue: "No exported function starting with 'use' found" });
      continue;
    }

    // Check none of the exports are non-hook names
    const badExports = allExported.filter(name => !name.startsWith("use"));
    if (badExports.length) {
      violations.push({ file, issue: `Exported functions without 'use' prefix: ${badExports.join(", ")}` });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RH002",
      message: `${violations.length} naming violation(s) — hook naming convention not followed`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { hookFiles } };
}
