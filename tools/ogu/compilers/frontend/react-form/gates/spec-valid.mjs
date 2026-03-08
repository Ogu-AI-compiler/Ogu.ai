/**
 * Gate: spec-valid
 * form-spec.json must exist with required fields.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const specPath = `${dir}/form-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "RF001", message: "form-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (err) {
    return { pass: false, code: "RF001", message: `form-spec.json parse error: ${err.message}` };
  }

  const missing = [];
  if (!spec.name) missing.push("name");
  if (!Array.isArray(spec.fields) || spec.fields.length === 0) missing.push("fields[]");
  if (!spec.submitRoute) missing.push("submitRoute");
  if (!spec.auth) missing.push("auth");

  if (missing.length) {
    return {
      pass: false,
      code: "RF001",
      message: `form-spec.json missing required fields: ${missing.join(", ")}`,
      detail: { missing },
    };
  }

  // Validate each field has name and type
  const invalidFields = spec.fields.filter(f => !f.name || !f.type);
  if (invalidFields.length) {
    return {
      pass: false,
      code: "RF001",
      message: `${invalidFields.length} field(s) missing name or type`,
      detail: { invalidFields },
    };
  }

  return {
    pass: true,
    detail: {
      name: spec.name,
      fieldCount: spec.fields.length,
      submitRoute: spec.submitRoute,
      auth: spec.auth,
    },
  };
}
