import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const upPath = `${dir}/up.sql`;
  if (!existsSync(upPath)) {
    return { pass: false, code: "DM009", message: "up.sql not found" };
  }

  const content = readFileSync(upPath, "utf8");
  const violations = [];

  // Find PRIMARY KEY inline definitions: id UUID PRIMARY KEY (without NOT NULL)
  // These are OK only if the DB implies NOT NULL for PK
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("--")) continue;

    // Pattern: column definition with PRIMARY KEY but explicit NULL
    if (/PRIMARY\s+KEY/i.test(line) && /\bNULL\b/i.test(line) && !/NOT\s+NULL/i.test(line)) {
      violations.push({
        line: i + 1,
        text: line.trim(),
        message: "Primary key column is explicitly nullable",
      });
    }

    // Pattern: PRIMARY KEY on a column that has no NOT NULL and no DEFAULT (risky)
    // This is a warning, not a hard violation for most DBs that imply NOT NULL on PK
  }

  // Check table-level PRIMARY KEY constraints against column definitions
  // Extract all PK columns from CONSTRAINT pk PRIMARY KEY (col1, col2) syntax
  const tableLevelPK = [...content.matchAll(/PRIMARY\s+KEY\s*\(([^)]+)\)/gi)];
  for (const pkMatch of tableLevelPK) {
    const pkCols = pkMatch[1].split(",").map(c => c.trim().replace(/["'`]/g, ""));
    for (const pkCol of pkCols) {
      // Find the column definition
      const colDefRe = new RegExp(`\\b${pkCol}\\b[^,\n]+`, "i");
      const colMatch = content.match(colDefRe);
      if (colMatch) {
        const colDef = colMatch[0];
        // If column definition has NULL without NOT NULL, it's a violation
        if (/\bNULL\b/i.test(colDef) && !/NOT\s+NULL/i.test(colDef)) {
          violations.push({
            column: pkCol,
            text: colDef.trim(),
            message: `Primary key column '${pkCol}' appears nullable`,
          });
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM009",
      message: `${violations.length} nullable primary key(s) detected`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: true } };
}
