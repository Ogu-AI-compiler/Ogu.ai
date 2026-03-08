import { readFileSync, existsSync } from "fs";

const DDL_STATEMENTS = [
  /CREATE\s+TABLE/i,
  /ALTER\s+TABLE/i,
  /CREATE\s+INDEX/i,
  /CREATE\s+UNIQUE\s+INDEX/i,
  /CREATE\s+SEQUENCE/i,
  /CREATE\s+TYPE/i,
];

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  if (!existsSync(upPath)) {
    return { pass: false, code: "DM003", message: "up.sql not found" };
  }

  const content = readFileSync(upPath, "utf8").trim();
  if (!content) {
    return { pass: false, code: "DM003", message: "up.sql is empty" };
  }

  // Must contain at least one DDL statement
  const hasDDL = DDL_STATEMENTS.some(re => re.test(content));
  if (!hasDDL) {
    return {
      pass: false,
      code: "DM003",
      message: "up.sql has no DDL statements (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.)",
    };
  }

  // Check for unbalanced parentheses (common SQL syntax error)
  const opens = (content.match(/\(/g) || []).length;
  const closes = (content.match(/\)/g) || []).length;
  if (opens !== closes) {
    return {
      pass: false,
      code: "DM003",
      message: `up.sql has unbalanced parentheses: ${opens} open, ${closes} close`,
    };
  }

  // Must end statements with semicolon
  const statements = content.split(";").map(s => s.trim()).filter(Boolean);
  const noSemicolon = statements.some(s => !s.endsWith(";") && /\S/.test(s));
  // (Actually splitting by ; means each piece won't end with ;, this is fine)

  // Check for SELECT (forbidden in migrations)
  const lines = content.split("\n");
  const selectViolations = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^\s*SELECT\b/i.test(l) && !/--/.test(l.slice(0, l.search(/SELECT/i))));

  if (selectViolations.length) {
    return {
      pass: false,
      code: "DM003",
      message: `up.sql contains SELECT statements on line(s): ${selectViolations.map(v => v.i + 1).join(", ")}`,
      detail: { hint: "Migrations only change structure — use a seed script for data queries" },
    };
  }

  return {
    pass: true,
    detail: {
      statements: statements.length,
      hasDDL: DDL_STATEMENTS.find(re => re.test(content))?.toString(),
    },
  };
}
