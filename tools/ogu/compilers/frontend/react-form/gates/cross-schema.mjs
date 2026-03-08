/**
 * Gate: cross-schema
 * If schema-artifact.json exists, form fields declared as data fields must
 * align with the schema's field names. Schema is the source of truth.
 *
 * UI-only fields (password confirmation, terms checkbox, captcha, etc.) are exempt.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

// Fields that are UI-only and don't need to exist in the schema
const UI_ONLY_FIELDS = new Set([
  "confirmPassword", "passwordConfirm", "confirm_password",
  "terms", "termsAccepted", "agreeToTerms",
  "captcha", "recaptcha",
  "rememberMe", "remember_me",
  "newsletter", "subscribeNewsletter",
  "currentPassword", "current_password",
]);

export async function run({ dir }) {
  const specPath = `${dir}/form-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No form-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  const candidates = [
    `${dir}/schema-artifact.json`,
    join(dirname(dir), "schema-artifact.json"),
    join(dirname(dir), "schema", "schema-artifact.json"),
  ];

  const artifactPath = candidates.find(p => existsSync(p));
  if (!artifactPath) {
    return { pass: true, skipped: true, detail: { reason: "No schema-artifact.json found — cross-schema not enforced" } };
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  if (artifact.schema !== "schema-artifact-v1") {
    return { pass: true, skipped: true, detail: { reason: `Unexpected artifact schema: ${artifact.schema}` } };
  }

  const schemaFields = new Set((artifact.fields || []).map(f => f.name || f));

  // Check data fields (non-UI-only) against schema
  const dataFields = (spec.fields || []).filter(f => !UI_ONLY_FIELDS.has(f.name));
  const violations = dataFields.filter(f => !schemaFields.has(f.name));

  if (violations.length) {
    return {
      pass: false,
      code: "RF009",
      message: `${violations.length} form field(s) not found in schema-artifact — schema is source of truth`,
      detail: {
        violations: violations.map(f => f.name),
        schemaFields: [...schemaFields],
        hint: "Add missing fields to ts-schema spec and recompile, or mark fields as ui-only in form-spec",
      },
    };
  }

  return {
    pass: true,
    detail: {
      schemaEntity: artifact.entity,
      alignedFields: dataFields.map(f => f.name),
      uiOnlyFields: (spec.fields || []).filter(f => UI_ONLY_FIELDS.has(f.name)).map(f => f.name),
    },
  };
}
