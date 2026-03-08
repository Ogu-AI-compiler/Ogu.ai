import { readFileSync, existsSync } from "fs";

const REQUIRED = ["entity", "fields", "relationships"];
const VALID_FIELD_TYPES = ["string", "number", "boolean", "date", "uuid", "email", "url", "enum", "object", "array", "any"];

export async function run({ dir }) {
  const specPath = `${dir}/schema-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "SC001", message: "schema-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "SC001", message: `schema-spec.json invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => !(f in spec));
  if (missing.length) {
    return { pass: false, code: "SC001", message: `Missing required fields: ${missing.join(", ")}` };
  }

  if (!spec.entity || !/^[A-Z][a-zA-Z0-9]+$/.test(spec.entity)) {
    return { pass: false, code: "SC001", message: `entity must be PascalCase. Got: ${spec.entity}` };
  }

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    return { pass: false, code: "SC001", message: "fields must be a non-empty array" };
  }

  // Validate each field has name and type
  const fieldErrors = [];
  for (const field of spec.fields) {
    if (!field.name) fieldErrors.push("field missing name");
    else if (!/^[a-z][a-zA-Z0-9_]*$/.test(field.name)) fieldErrors.push(`field name must be camelCase: ${field.name}`);
    if (!field.type) fieldErrors.push(`field '${field.name}' missing type`);
  }
  if (fieldErrors.length) {
    return { pass: false, code: "SC001", message: `Field errors: ${fieldErrors.join("; ")}` };
  }

  if (!Array.isArray(spec.relationships)) {
    return { pass: false, code: "SC001", message: "relationships must be an array (can be empty)" };
  }

  return {
    pass: true,
    detail: {
      entity: spec.entity,
      fields: spec.fields.length,
      relationships: spec.relationships.length,
    },
  };
}
