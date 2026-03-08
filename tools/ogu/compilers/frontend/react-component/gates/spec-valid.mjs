/**
 * Gate: spec-valid
 * Verifies component-spec.json exists and has required fields.
 */
import { readFileSync, existsSync } from "fs";

const REQUIRED = ["name", "props", "variants"];

export async function run({ dir }) {
  const specPath = `${dir}/component-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "RC001", message: "component-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "RC001", message: `component-spec.json invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => !(f in spec));
  if (missing.length) {
    return { pass: false, code: "RC001", message: `component-spec.json missing fields: ${missing.join(", ")}` };
  }

  if (!spec.name || typeof spec.name !== "string" || !/^[A-Z][a-zA-Z0-9]+$/.test(spec.name)) {
    return { pass: false, code: "RC001", message: `spec.name must be PascalCase, got: ${spec.name}` };
  }

  if (!Array.isArray(spec.props)) {
    return { pass: false, code: "RC001", message: "spec.props must be an array" };
  }

  if (!Array.isArray(spec.variants)) {
    return { pass: false, code: "RC001", message: "spec.variants must be an array" };
  }

  return { pass: true, detail: { name: spec.name, props: spec.props.length, variants: spec.variants.length } };
}
