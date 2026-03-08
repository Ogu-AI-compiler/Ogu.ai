/**
 * Gate: naming-valid
 * Page file must export a PascalCase component ending in Page or View.
 * File should be named Page.tsx or {Name}Page.tsx.
 */
import { readFileSync, existsSync, readdirSync } from "fs";

export async function run({ dir }) {
  let pageFiles;
  try {
    pageFiles = readdirSync(dir).filter(f =>
      /^[A-Z].+\.(tsx)$/.test(f) && !f.endsWith(".test.tsx")
    );
  } catch {
    return { pass: false, code: "RP002", message: `Cannot read directory: ${dir}` };
  }

  if (pageFiles.length === 0) {
    return { pass: false, code: "RP002", message: "No Page.tsx file found in directory" };
  }

  const violations = [];

  for (const file of pageFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");

    // Find exported components
    const exportedComponents = [
      ...[...content.matchAll(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/g)].map(m => m[1]),
      ...[...content.matchAll(/export\s+const\s+([A-Z]\w+)\s*=/g)].map(m => m[1]),
    ];

    const pageComponents = exportedComponents.filter(n => n.endsWith("Page") || n.endsWith("View"));

    if (pageComponents.length === 0 && exportedComponents.length > 0) {
      violations.push({
        file,
        issue: `Exported components [${exportedComponents.join(", ")}] must end with "Page" or "View"`,
        hint: "e.g. UserProfilePage, DashboardView",
      });
    } else if (exportedComponents.length === 0) {
      violations.push({ file, issue: "No exported React component found" });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RP002",
      message: `${violations.length} naming violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { pageFiles } };
}
