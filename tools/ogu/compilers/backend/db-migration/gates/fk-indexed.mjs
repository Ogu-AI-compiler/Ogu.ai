import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  const specPath = `${dir}/migration-spec.json`;

  if (!existsSync(upPath)) {
    return { pass: false, code: "DM010", message: "up.sql not found" };
  }

  const content = readFileSync(upPath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // Extract FK columns from SQL: REFERENCES keyword implies FK
  const fkColumns = new Set();

  // Inline FK: col_name TYPE REFERENCES other_table(id)
  for (const m of content.matchAll(/(\w+)\s+\w[\w(,)\s]*REFERENCES\s+\w+/gi)) {
    // The column name is the first word on the line
    const line = content.slice(Math.max(0, content.lastIndexOf("\n", m.index) + 1), m.index + m[0].length);
    const colName = line.trim().split(/\s+/)[0].replace(/["'`]/g, "");
    if (colName && /^[a-z_]+$/.test(colName)) fkColumns.add(colName);
  }

  // CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES
  for (const m of content.matchAll(/FOREIGN\s+KEY\s*\(([^)]+)\)/gi)) {
    m[1].split(",").map(c => c.trim().replace(/["'`]/g, "")).forEach(c => fkColumns.add(c));
  }

  // From spec.foreignKeys
  for (const fk of spec.foreignKeys || []) {
    if (fk.column) fkColumns.add(fk.column);
    if (fk.columns) fk.columns.forEach(c => fkColumns.add(c));
  }

  if (!fkColumns.size) {
    return { pass: true, detail: { note: "No foreign keys found — gate not applicable" } };
  }

  // Check each FK column has a CREATE INDEX
  const violations = [];
  for (const col of fkColumns) {
    // Look for any index that includes this column
    const indexRe = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX[^(]+\\([^)]*${col}[^)]*\\)`, "i");
    if (!indexRe.test(content)) {
      violations.push({
        column: col,
        message: `Foreign key column '${col}' has no index — will cause full table scans on JOINs`,
        hint: `Add: CREATE INDEX IF NOT EXISTS {table}_${col}_idx ON {table}(${col});`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM010",
      message: `${violations.length} FK column(s) missing index`,
      detail: { violations, fkColumns: [...fkColumns] },
    };
  }

  return { pass: true, detail: { fkColumns: [...fkColumns], allIndexed: true } };
}
