import { readFileSync, existsSync } from "fs";

function extractOperations(sql) {
  const ops = [];
  // CREATE TABLE
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi)) {
    ops.push({ type: "CREATE_TABLE", name: m[1] });
  }
  // CREATE INDEX
  for (const m of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi)) {
    ops.push({ type: "CREATE_INDEX", name: m[1] });
  }
  // CREATE TYPE
  for (const m of sql.matchAll(/CREATE\s+TYPE\s+["']?(\w+)["']?/gi)) {
    ops.push({ type: "CREATE_TYPE", name: m[1] });
  }
  // CREATE SEQUENCE
  for (const m of sql.matchAll(/CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi)) {
    ops.push({ type: "CREATE_SEQUENCE", name: m[1] });
  }
  // ALTER TABLE ... ADD COLUMN
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?/gi)) {
    ops.push({ type: "ADD_COLUMN", table: m[1], name: m[2] });
  }
  return ops;
}

function hasInverse(op, downSql) {
  switch (op.type) {
    case "CREATE_TABLE":
      return new RegExp(`DROP\\s+TABLE.*${op.name}`, "i").test(downSql);
    case "CREATE_INDEX":
      return new RegExp(`DROP\\s+INDEX.*${op.name}`, "i").test(downSql);
    case "CREATE_TYPE":
      return new RegExp(`DROP\\s+TYPE.*${op.name}`, "i").test(downSql);
    case "CREATE_SEQUENCE":
      return new RegExp(`DROP\\s+SEQUENCE.*${op.name}`, "i").test(downSql);
    case "ADD_COLUMN":
      return new RegExp(`ALTER\\s+TABLE.*${op.table}.*DROP\\s+COLUMN.*${op.name}`, "i").test(downSql);
    default:
      return true;
  }
}

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  const downPath = `${dir}/down.sql`;

  if (!existsSync(upPath) || !existsSync(downPath)) {
    return { pass: false, code: "DM008", message: "up.sql or down.sql not found" };
  }

  const up = readFileSync(upPath, "utf8");
  const down = readFileSync(downPath, "utf8");

  const upOps = extractOperations(up);
  const missing = upOps.filter(op => !hasInverse(op, down));

  if (missing.length) {
    return {
      pass: false,
      code: "DM008",
      message: `${missing.length} operation(s) in up.sql have no inverse in down.sql`,
      detail: {
        missing: missing.map(op => `${op.type} ${op.name || `${op.table}.${op.name}`}`),
      },
    };
  }

  return { pass: true, detail: { upOperations: upOps.length, allRolledBack: true } };
}
