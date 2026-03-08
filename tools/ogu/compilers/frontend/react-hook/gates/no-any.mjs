/**
 * Gate: no-any
 * No untyped `any` in hook implementation.
 */
import { readFileSync, existsSync, readdirSync } from "fs";

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH004", message: "No hook file found" };
  }

  const violations = [];
  for (const file of hookFiles) {
    const lines = readFileSync(`${dir}/${file}`, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//")) continue;
      if (/:\s*any\b|as\s+any\b|<any>/.test(line)) {
        violations.push({ file, line: i + 1, content: line.trim() });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RH004",
      message: `${violations.length} untyped \`any\` usage(s) found`,
      detail: { violations },
    };
  }

  return { pass: true };
}
