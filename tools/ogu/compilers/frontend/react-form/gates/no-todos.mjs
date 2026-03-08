/**
 * Gate: no-todos
 * No TODO/FIXME/HACK/PLACEHOLDER in Form.tsx or form-schema.ts.
 */
import { readFileSync, existsSync } from "fs";

const TODO_RE = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const files = ["Form.tsx", "form-schema.ts"].map(f => `${dir}/${f}`);
  const violations = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (TODO_RE.test(lines[i])) {
        violations.push({ file: filePath.split("/").pop(), line: i + 1, content: lines[i].trim() });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RF007",
      message: `${violations.length} TODO/FIXME/HACK found`,
      detail: { violations },
    };
  }

  return { pass: true };
}
