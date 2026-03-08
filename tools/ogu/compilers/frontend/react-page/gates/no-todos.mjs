import { readFileSync, existsSync } from "fs";

const TODO_RE = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  if (!existsSync(pagePath)) return { pass: false, code: "RP008", message: "Page.tsx not found" };

  const violations = [];
  const lines = readFileSync(pagePath, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (TODO_RE.test(lines[i])) {
      violations.push({ line: i + 1, content: lines[i].trim() });
    }
  }

  if (violations.length) {
    return { pass: false, code: "RP008", message: `${violations.length} TODO/FIXME/HACK found`, detail: { violations } };
  }
  return { pass: true };
}
