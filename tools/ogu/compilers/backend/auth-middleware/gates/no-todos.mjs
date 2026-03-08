import { readFileSync, existsSync } from "fs";

const MARKER_RE = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const files = ["middleware.ts", "token.ts", "errors.ts", "types.ts"]
    .map(f => `${dir}/${f}`)
    .filter(existsSync);

  const violations = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (MARKER_RE.test(lines[i])) {
        violations.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: "AM005", message: `${violations.length} TODO/FIXME marker(s)`, detail: { violations } };
  }

  return { pass: true, detail: { checked: files.length } };
}
