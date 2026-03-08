import { readFileSync, existsSync } from "fs";

const DESTRUCTIVE = [
  { re: /^\s*DROP\s+TABLE\b(?!\s+IF\s+EXISTS\s+\w+\s*;?\s*$)/im, label: "DROP TABLE" },
  { re: /ALTER\s+TABLE.*DROP\s+COLUMN/i, label: "DROP COLUMN" },
  { re: /^\s*TRUNCATE\b/im, label: "TRUNCATE" },
  { re: /^\s*DROP\s+DATABASE\b/im, label: "DROP DATABASE" },
  { re: /ALTER\s+TABLE.*MODIFY\s+COLUMN/i, label: "MODIFY COLUMN (potential data loss)" },
];

export async function run({ dir }) {
  const specPath = `${dir}/migration-spec.json`;
  const upPath = `${dir}/up.sql`;

  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // If spec explicitly allows destructive ops, skip this gate
  if (spec.allowDestructive === true) {
    return { pass: true, detail: { note: "allowDestructive: true — gate skipped by spec" } };
  }

  if (!existsSync(upPath)) {
    return { pass: false, code: "DM006", message: "up.sql not found" };
  }

  const content = readFileSync(upPath, "utf8");
  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trimStart().startsWith("--")) continue;

    for (const { re, label } of DESTRUCTIVE) {
      if (re.test(line)) {
        violations.push({ line: i + 1, type: label, text: line.trim() });
      }
    }
  }

  // DROP TABLE in up.sql is always suspicious (up should create, not drop)
  // But allow it if it's for rollback of a previous partial migration
  const hasDropTable = /^\s*DROP\s+TABLE/im.test(content);
  if (hasDropTable && !spec.allowDestructive) {
    violations.push({
      line: "?",
      type: "DROP TABLE in up.sql",
      text: "DROP TABLE found in up.sql — use down.sql for rollbacks. Set allowDestructive: true if intentional.",
    });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM006",
      message: `${violations.length} destructive operation(s) in up.sql without allowDestructive flag`,
      detail: { violations, hint: "Set spec.allowDestructive: true if this is intentional" },
    };
  }

  return { pass: true, detail: { checked: upPath } };
}
