/**
 * Gate: field-coverage
 * Verifies that every field declared in schema-spec.json has a
 * corresponding Zod definition in schema.ts.
 *
 * The schema is the source of truth — it must be complete.
 * Components and routes will validate against it, so any undeclared
 * field will cause their cross-schema gates to fail.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const specPath = `${dir}/schema-spec.json`;
  const schemaPath = `${dir}/schema.ts`;

  if (!existsSync(specPath)) {
    return { pass: false, code: "SC008", message: "schema-spec.json not found" };
  }
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC008", message: "schema.ts not found" };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const schemaContent = readFileSync(schemaPath, "utf8");

  const declaredFields = (spec.fields || []).map(f => f.name || f);
  if (!declaredFields.length) {
    return { pass: true, detail: { note: "No fields declared in spec" } };
  }

  // Find the main entity schema block — look for the primary schema (EntitySchema)
  const entity = spec.entity;
  const primarySchemaRe = new RegExp(`const\\s+${entity}Schema\\s*=\\s*z\\.object\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`, "m");
  const match = schemaContent.match(primarySchemaRe);

  const missing = [];

  if (!match) {
    // Primary schema not found — check if fields appear anywhere in the file
    for (const field of declaredFields) {
      const fieldRe = new RegExp(`\\b${field}\\s*:`);
      if (!fieldRe.test(schemaContent)) {
        missing.push(field);
      }
    }
  } else {
    const schemaBody = match[1];
    for (const field of declaredFields) {
      const fieldRe = new RegExp(`\\b${field}\\s*:`);
      if (!fieldRe.test(schemaBody)) {
        missing.push(field);
      }
    }
  }

  if (missing.length > 0) {
    return {
      pass: false,
      code: "SC008",
      message: `${missing.length} field(s) declared in spec but missing from schema.ts: ${missing.join(", ")}`,
      detail: {
        missing,
        entity,
        hint: `Add these fields to the ${entity}Schema z.object({ ... }) definition`,
      },
    };
  }

  return {
    pass: true,
    detail: {
      entity,
      declaredFields: declaredFields.length,
      implemented: declaredFields.length,
    },
  };
}
