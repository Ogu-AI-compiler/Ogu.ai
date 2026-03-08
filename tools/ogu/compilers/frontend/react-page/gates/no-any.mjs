import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  if (!existsSync(pagePath)) return { pass: false, code: "RP004", message: "Page.tsx not found" };

  const violations = [];
  const lines = readFileSync(pagePath, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("//")) continue;
    if (/:\s*any\b|as\s+any\b|<any>/.test(lines[i])) {
      violations.push({ line: i + 1, content: lines[i].trim() });
    }
  }

  if (violations.length) {
    return { pass: false, code: "RP004", message: `${violations.length} untyped \`any\` usage(s)`, detail: { violations } };
  }
  return { pass: true };
}
