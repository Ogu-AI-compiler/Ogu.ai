/**
 * Gate: no-todos
 * Scans implementation files for TODO/FIXME/HACK/PLACEHOLDER.
 */
import { readFileSync, existsSync } from "fs";

const MARKERS = ["TODO", "FIXME", "HACK", "PLACEHOLDER", "XXX"];
const MARKER_RE = new RegExp(MARKERS.join("|"), "i");

export async function run({ dir, name, files }) {
  const toCheck = files || [`${dir}/${name}.tsx`, `${dir}/${name}.types.ts`];
  const violations = [];

  for (const file of toCheck) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (MARKER_RE.test(lines[i])) {
        violations.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC006",
      message: `Found ${violations.length} TODO/FIXME marker(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: toCheck.length } };
}
