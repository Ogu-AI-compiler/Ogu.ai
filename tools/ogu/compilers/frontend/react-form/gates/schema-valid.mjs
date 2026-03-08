/**
 * Gate: schema-valid
 * form-schema.ts must exist and export a Zod schema covering all declared fields.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/form-schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "RF002", message: "form-schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");

  if (!content.includes("from \"zod\"") && !content.includes("from 'zod'")) {
    return { pass: false, code: "RF002", message: "form-schema.ts does not import from zod" };
  }

  if (!content.includes("z.object(")) {
    return { pass: false, code: "RF002", message: "form-schema.ts must define a z.object schema" };
  }

  // Check there's an export
  if (!/export\s+(const|type|default)/.test(content)) {
    return { pass: false, code: "RF002", message: "form-schema.ts has no exports" };
  }

  // Cross-check: all fields in spec should appear in schema
  const specPath = `${dir}/form-spec.json`;
  if (existsSync(specPath)) {
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    const missing = spec.fields
      .filter(f => f.name)
      .filter(f => !content.includes(f.name));

    if (missing.length) {
      return {
        pass: false,
        code: "RF002",
        message: `form-schema.ts missing ${missing.length} field(s) declared in spec`,
        detail: { missing: missing.map(f => f.name) },
      };
    }
  }

  return { pass: true, detail: { hasZodObject: true } };
}
