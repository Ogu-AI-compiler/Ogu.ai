/**
 * Gate: no-any
 * No untyped `any` in Form.tsx or form-schema.ts.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const files = ["Form.tsx", "form-schema.ts"].map(f => `${dir}/${f}`);
  const violations = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//")) continue;
      // Match `: any` or `as any` or `<any>` — not `// any` comments
      if (/:\s*any\b|as\s+any\b|<any>/.test(line)) {
        violations.push({ file: filePath.split("/").pop(), line: i + 1, content: line.trim() });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RF004",
      message: `${violations.length} untyped \`any\` usage(s) found`,
      detail: { violations },
    };
  }

  return { pass: true };
}
