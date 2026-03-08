import { readFileSync, existsSync, readdirSync } from "fs";

const TODO_RE = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  const violations = [];
  for (const file of hookFiles) {
    const lines = readFileSync(`${dir}/${file}`, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (TODO_RE.test(lines[i])) {
        violations.push({ file, line: i + 1, content: lines[i].trim() });
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: "RH007", message: `${violations.length} TODO/FIXME/HACK found`, detail: { violations } };
  }

  return { pass: true };
}
