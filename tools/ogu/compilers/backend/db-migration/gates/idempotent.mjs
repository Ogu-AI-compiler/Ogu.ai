import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  const downPath = `${dir}/down.sql`;

  if (!existsSync(upPath)) {
    return { pass: false, code: "DM007", message: "up.sql not found" };
  }

  const up = readFileSync(upPath, "utf8");
  const down = existsSync(downPath) ? readFileSync(downPath, "utf8") : "";
  const violations = [];

  // CREATE TABLE without IF NOT EXISTS
  const createTableMatches = [...up.matchAll(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)["']?(\w+)["']?/gi)];
  for (const m of createTableMatches) {
    violations.push({
      type: "create-table-not-idempotent",
      table: m[1],
      message: `CREATE TABLE ${m[1]} should use CREATE TABLE IF NOT EXISTS`,
    });
  }

  // CREATE INDEX without IF NOT EXISTS
  const createIndexMatches = [...up.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)["']?(\w+)["']?/gi)];
  for (const m of createIndexMatches) {
    violations.push({
      type: "create-index-not-idempotent",
      index: m[1],
      message: `CREATE INDEX ${m[1]} should use CREATE INDEX IF NOT EXISTS`,
    });
  }

  // DROP TABLE without IF EXISTS (in down.sql)
  const dropTableMatches = [...down.matchAll(/DROP\s+TABLE\s+(?!IF\s+EXISTS)["']?(\w+)["']?/gi)];
  for (const m of dropTableMatches) {
    violations.push({
      type: "drop-table-not-idempotent",
      table: m[1],
      message: `DROP TABLE ${m[1]} in down.sql should use DROP TABLE IF EXISTS`,
    });
  }

  // DROP INDEX without IF EXISTS
  const dropIndexMatches = [...down.matchAll(/DROP\s+INDEX\s+(?!IF\s+EXISTS)["']?(\w+)["']?/gi)];
  for (const m of dropIndexMatches) {
    violations.push({
      type: "drop-index-not-idempotent",
      index: m[1],
      message: `DROP INDEX ${m[1]} in down.sql should use DROP INDEX IF EXISTS`,
    });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM007",
      message: `${violations.length} non-idempotent operation(s) — add IF NOT EXISTS / IF EXISTS guards`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { idempotent: true } };
}
