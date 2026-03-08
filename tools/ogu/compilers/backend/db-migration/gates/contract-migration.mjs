import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  const specPath = `${dir}/migration-spec.json`;

  if (!existsSync(upPath)) {
    return { pass: false, code: "DM012", message: "up.sql not found" };
  }

  const content = readFileSync(upPath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const violations = [];

  // Rule: timestamp-columns (for CREATE TABLE)
  if (/CREATE\s+TABLE/i.test(content)) {
    if (!/created_at/i.test(content)) {
      violations.push({ rule: "timestamp-columns", message: "CREATE TABLE missing created_at TIMESTAMP NOT NULL DEFAULT NOW()" });
    }
    if (!/updated_at/i.test(content)) {
      violations.push({ rule: "timestamp-columns", message: "CREATE TABLE missing updated_at TIMESTAMP NOT NULL DEFAULT NOW()" });
    }
    // Check NOT NULL DEFAULT NOW() on timestamp columns
    const lines = content.split("\n");
    for (const line of lines) {
      if (/created_at|updated_at/i.test(line)) {
        if (!/NOT\s+NULL/i.test(line)) {
          violations.push({ rule: "timestamp-columns", message: `Timestamp column should be NOT NULL: ${line.trim()}` });
        }
        if (!/DEFAULT\s+NOW\(\)|DEFAULT\s+CURRENT_TIMESTAMP/i.test(line)) {
          violations.push({ rule: "timestamp-columns", message: `Timestamp column should have DEFAULT NOW(): ${line.trim()}` });
        }
      }
    }
  }

  // Rule: soft-delete column
  if (spec.softDelete && !/deleted_at/i.test(content)) {
    violations.push({ rule: "soft-delete", message: "spec.softDelete is true but deleted_at TIMESTAMP NULL not found" });
  }

  // Rule: id-convention
  if (/CREATE\s+TABLE/i.test(content)) {
    if (!/(id\s+UUID|id\s+BIGSERIAL|id\s+SERIAL|id\s+BIGINT)/i.test(content)) {
      violations.push({ rule: "id-convention", message: "Primary key 'id' must use UUID, BIGSERIAL, or SERIAL" });
    }
  }

  // Rule: snake-case-columns — detect camelCase
  const camelCaseRe = /\b([a-z]+[A-Z][a-zA-Z]*)\b/;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("--")) continue;
    const match = line.match(camelCaseRe);
    if (match && !["NOT", "NULL", "DEFAULT", "REFERENCES", "PRIMARY", "FOREIGN", "UNIQUE", "INDEX"].some(kw => line.includes(kw) && match[1] === kw)) {
      // Exclude SQL keywords that are naturally camelCase-like
      const word = match[1];
      if (!/^(NOT|EXISTS|INDEX|UNIQUE|DEFAULT|REFERENCES|PRIMARY|FOREIGN|CREATE|TABLE|ALTER|COLUMN|CONSTRAINT|INTEGER|VARCHAR|BOOLEAN|TIMESTAMP|JSONB|BIGINT|BIGSERIAL|SERIAL)$/i.test(word)) {
        violations.push({ rule: "snake-case-columns", message: `Possible camelCase column name on line ${i + 1}: '${word}'` });
      }
    }
  }

  // Rule: no-select-in-migration
  if (/^\s*SELECT\b/im.test(content)) {
    violations.push({ rule: "no-select-in-migration", message: "SELECT statement found in migration — use seed scripts for data queries" });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM012",
      message: `Migration contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { table: spec.table } };
}
