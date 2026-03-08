/**
 * Gate: contract-shape
 * Validates component against component-shape.contract.json rules.
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, "../contracts/component-shape.contract.json");

export async function run({ dir, name }) {
  const implPath = `${dir}/${name}.tsx`;
  const indexPath = `${dir}/index.ts`;

  if (!existsSync(implPath)) {
    return { pass: false, code: "RC008", message: `${name}.tsx not found` };
  }

  const impl = readFileSync(implPath, "utf8");
  const index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  const violations = [];

  // Rule: named export
  if (!new RegExp(`export\\s+(function|const|class)\\s+${name}|export\\s*\\{[^}]*${name}[^}]*\\}`).test(impl)) {
    violations.push({ rule: "named-export", message: `No named export for ${name} in ${name}.tsx` });
  }

  // Rule: typed props
  if (!new RegExp(`(interface|type)\\s+${name}Props`).test(impl + index)) {
    violations.push({ rule: "typed-props", message: `No ${name}Props type found` });
  }

  // Rule: display-name (warn, not fail)
  const hasDisplayName = impl.includes(`${name}.displayName`);

  // Rule: no inline styles
  const inlineStyleLines = impl.split("\n").filter(l => /style=\{\{/.test(l));
  if (inlineStyleLines.length > 0) {
    violations.push({ rule: "no-inline-styles", message: `Inline styles found on ${inlineStyleLines.length} line(s)` });
  }

  // Rule: index re-export
  if (index && !index.includes(name)) {
    violations.push({ rule: "index-reexport", message: `index.ts does not mention ${name}` });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC008",
      message: `Shape contract: ${violations.length} violation(s)`,
      detail: { violations, warnings: hasDisplayName ? [] : [`${name}.displayName not set (recommended)`] },
    };
  }

  return {
    pass: true,
    detail: {
      warnings: hasDisplayName ? [] : [`${name}.displayName not set (recommended)`],
    },
  };
}
