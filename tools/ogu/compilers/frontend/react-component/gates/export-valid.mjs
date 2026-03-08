/**
 * Gate: export-valid
 * Verifies index.ts exports the component as named and default.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir, name }) {
  const indexPath = `${dir}/index.ts`;
  if (!existsSync(indexPath)) {
    return { pass: false, code: "RC010", message: "index.ts not found" };
  }

  const content = readFileSync(indexPath, "utf8");

  const hasNamedExport = content.includes(`export { ${name}`) || content.includes(`export type { ${name}`);
  const hasDefaultExport = content.includes(`export default ${name}`) || content.includes(`export { ${name} as default`);
  const hasReExport = content.includes(`from './${name}'`) || content.includes(`from "./${name}"`);

  if (!hasReExport) {
    return { pass: false, code: "RC010", message: `index.ts does not re-export from ./${name}` };
  }

  if (!hasNamedExport) {
    return { pass: false, code: "RC010", message: `index.ts missing named export for ${name}` };
  }

  if (!hasDefaultExport) {
    return { pass: false, code: "RC010", message: `index.ts missing default export for ${name}` };
  }

  return { pass: true, detail: { index: indexPath } };
}
