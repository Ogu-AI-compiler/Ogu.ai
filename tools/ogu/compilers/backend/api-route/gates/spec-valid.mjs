import { readFileSync, existsSync } from "fs";

const REQUIRED = ["method", "path", "input", "output", "auth"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function run({ dir }) {
  const specPath = `${dir}/route-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "AR001", message: "route-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "AR001", message: `route-spec.json invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => !(f in spec));
  if (missing.length) {
    return { pass: false, code: "AR001", message: `Missing fields: ${missing.join(", ")}` };
  }

  if (!METHODS.includes(spec.method?.toUpperCase())) {
    return { pass: false, code: "AR001", message: `Invalid method: ${spec.method}. Must be one of ${METHODS.join(", ")}` };
  }

  if (!spec.path?.startsWith("/")) {
    return { pass: false, code: "AR001", message: `path must start with /. Got: ${spec.path}` };
  }

  const validAuth = ["none", "bearer", "session", "api-key", "required"];
  if (!validAuth.includes(spec.auth)) {
    return { pass: false, code: "AR001", message: `auth must be one of: ${validAuth.join(", ")}. Got: ${spec.auth}` };
  }

  return { pass: true, detail: { method: spec.method, path: spec.path, auth: spec.auth } };
}
