import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const downPath = `${dir}/down.sql`;
  const upPath = `${dir}/up.sql`;

  if (!existsSync(downPath)) {
    return { pass: false, code: "DM004", message: "down.sql not found — every migration must have a rollback" };
  }

  const down = readFileSync(downPath, "utf8").trim();
  if (!down) {
    return { pass: false, code: "DM004", message: "down.sql is empty — rollback is required" };
  }

  const up = existsSync(upPath) ? readFileSync(upPath, "utf8") : "";

  // Check inverse operations
  const violations = [];

  if (/CREATE\s+TABLE\s+(\w+)/i.test(up)) {
    const tableName = up.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i)?.[1];
    if (tableName && !new RegExp(`DROP\\s+TABLE.*${tableName}`, "i").test(down)) {
      violations.push(`up.sql creates table '${tableName}' but down.sql doesn't DROP it`);
    }
  }

  if (/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/ig.test(up)) {
    const indexes = [...up.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/ig)]
      .map(m => m[1]);
    for (const idx of indexes) {
      if (!new RegExp(`DROP\\s+INDEX.*${idx}`, "i").test(down)) {
        violations.push(`up.sql creates index '${idx}' but down.sql doesn't DROP it`);
      }
    }
  }

  if (/ALTER\s+TABLE.*ADD\s+COLUMN/i.test(up)) {
    if (!/ALTER\s+TABLE.*DROP\s+COLUMN/i.test(down)) {
      violations.push("up.sql adds column(s) but down.sql doesn't DROP them");
    }
  }

  if (/CREATE\s+TYPE/i.test(up)) {
    if (!/DROP\s+TYPE/i.test(down)) {
      violations.push("up.sql creates TYPE but down.sql doesn't DROP it");
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM004",
      message: `Incomplete rollback: ${violations.length} operation(s) in up.sql have no inverse`,
      detail: { violations },
    };
  }

  // down.sql must have DDL
  if (!/DROP|ALTER|TRUNCATE/i.test(down)) {
    return {
      pass: false,
      code: "DM004",
      message: "down.sql contains no DDL statements (DROP, ALTER, etc.)",
    };
  }

  return { pass: true, detail: { downStatements: down.split(";").filter(s => s.trim()).length } };
}
