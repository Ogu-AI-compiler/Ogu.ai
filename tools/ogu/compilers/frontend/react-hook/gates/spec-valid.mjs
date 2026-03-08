/**
 * Gate: spec-valid
 * hook-spec.json must exist with: name (use* prefix), purpose, returns.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const specPath = `${dir}/hook-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "RH001", message: "hook-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (err) {
    return { pass: false, code: "RH001", message: `hook-spec.json parse error: ${err.message}` };
  }

  const missing = [];
  if (!spec.name) missing.push("name");
  if (!spec.purpose) missing.push("purpose");
  if (!spec.returns) missing.push("returns");

  if (missing.length) {
    return {
      pass: false,
      code: "RH001",
      message: `hook-spec.json missing: ${missing.join(", ")}`,
      detail: { missing },
    };
  }

  if (!spec.name.startsWith("use")) {
    return {
      pass: false,
      code: "RH001",
      message: `Hook name must start with "use" — got: "${spec.name}"`,
    };
  }

  if (spec.name[3] && spec.name[3] !== spec.name[3].toUpperCase()) {
    return {
      pass: false,
      code: "RH001",
      message: `Hook name must be in camelCase after "use" — got: "${spec.name}"`,
    };
  }

  return {
    pass: true,
    detail: {
      name: spec.name,
      purpose: spec.purpose,
      hasSideEffects: !!spec.sideEffects,
      isAsync: !!spec.async,
    },
  };
}
