import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC002", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");

  // Must import from 'zod'
  const hasZodImport = /import\s+.*\bz\b.*from\s+['"]zod['"]/.test(content) ||
    /import\s+\*\s+as\s+z\s+from\s+['"]zod['"]/.test(content) ||
    /require\(['"]zod['"]\)/.test(content);

  if (!hasZodImport) {
    return { pass: false, code: "SC002", message: "schema.ts does not import from 'zod'" };
  }

  // Must have at least one exported schema
  const exportedSchemas = [...content.matchAll(/export\s+const\s+(\w+Schema)\s*=/g)].map(m => m[1]);
  if (!exportedSchemas.length) {
    return { pass: false, code: "SC002", message: "schema.ts has no exported *Schema constants" };
  }

  // Syntax sanity: balanced braces and parens
  const opens = (content.match(/\{/g) || []).length;
  const closes = (content.match(/\}/g) || []).length;
  if (Math.abs(opens - closes) > 2) {
    return { pass: false, code: "SC002", message: `schema.ts has unbalanced braces (${opens} open, ${closes} close)` };
  }

  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 2) {
    return { pass: false, code: "SC002", message: `schema.ts has unbalanced parentheses` };
  }

  // Must use z. prefix (not just import z but never use it)
  const hasZUsage = /\bz\.(string|number|boolean|object|array|enum|union|discriminatedUnion|literal|date|null|undefined|optional|record|tuple|any|unknown|never|void|infer)/.test(content);
  if (!hasZUsage) {
    return { pass: false, code: "SC002", message: "schema.ts imports z but never uses it" };
  }

  return {
    pass: true,
    detail: { schemas: exportedSchemas, count: exportedSchemas.length },
  };
}
