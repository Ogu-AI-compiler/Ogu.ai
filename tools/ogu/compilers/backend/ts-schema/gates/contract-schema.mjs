import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  const typesPath = `${dir}/types.ts`;

  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC011", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");
  const typesContent = existsSync(typesPath) ? readFileSync(typesPath, "utf8") : "";
  const combined = content + "\n" + typesContent;
  const violations = [];

  // Rule: pascal-case-schemas
  const allSchemas = [...content.matchAll(/export\s+const\s+(\w+)\s*=\s*z\./g)].map(m => m[1]);
  for (const name of allSchemas) {
    if (!name.endsWith("Schema")) {
      violations.push({ rule: "pascal-case-schemas", message: `'${name}' should end with 'Schema'` });
    } else if (!/^[A-Z]/.test(name)) {
      violations.push({ rule: "pascal-case-schemas", message: `'${name}' must start with uppercase` });
    }
  }

  // Rule: no-z-object-direct-export (export default z.object is forbidden)
  if (/export\s+default\s+z\.object/.test(content)) {
    violations.push({ rule: "no-z-object-direct-export", message: "export default z.object() — assign to named const first" });
  }

  // Rule: id-field-type — id fields must be uuid() or cuid()
  const idFieldRe = /\bid\s*:\s*z\.string\(\)(?!\.uuid|\.cuid)/g;
  const idViolations = [...content.matchAll(idFieldRe)];
  for (const match of idViolations) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    violations.push({
      rule: "id-field-type",
      message: `id field on line ${lineNum} should use z.string().uuid() or z.string().cuid()`,
    });
  }

  // Rule: date-fields — createdAt/updatedAt must use .datetime() or z.date()
  const dateFieldRe = /\b(createdAt|updatedAt|deletedAt|publishedAt)\s*:\s*z\.string\(\)(?!\.datetime)/g;
  const dateViolations = [...content.matchAll(dateFieldRe)];
  for (const match of dateViolations) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    violations.push({
      rule: "date-fields",
      message: `'${match[1]}' on line ${lineNum} should use z.string().datetime() or z.date()`,
    });
  }

  // Rule: no-nested-any — z.record(z.any()) without justification
  const recordAnyRe = /z\.record\s*\(\s*z\.any\s*\(\s*\)\s*\)/g;
  for (const match of [...content.matchAll(recordAnyRe)]) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    const prevLine = content.split("\n")[lineNum - 2] || "";
    if (!/justification|reason|note|why/i.test(prevLine)) {
      violations.push({
        rule: "no-nested-any",
        message: `z.record(z.any()) on line ${lineNum} needs a justification comment`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "SC011",
      message: `Schema contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { schemas: allSchemas.length } };
}
