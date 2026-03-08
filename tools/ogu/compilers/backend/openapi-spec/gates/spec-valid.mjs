/**
 * Gate: spec-valid
 * openapi-spec.json must exist with: title, version, servers[], and scan paths.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const specPath = `${dir}/openapi-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "OS001", message: "openapi-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (err) {
    return { pass: false, code: "OS001", message: `openapi-spec.json parse error: ${err.message}` };
  }

  const missing = [];
  if (!spec.title) missing.push("title");
  if (!spec.version) missing.push("version");
  if (!Array.isArray(spec.servers) || spec.servers.length === 0) missing.push("servers[]");
  if (!Array.isArray(spec.scanPaths) || spec.scanPaths.length === 0) missing.push("scanPaths[]");

  if (missing.length) {
    return {
      pass: false,
      code: "OS001",
      message: `openapi-spec.json missing: ${missing.join(", ")}`,
      detail: { missing },
    };
  }

  return {
    pass: true,
    detail: { title: spec.title, version: spec.version, servers: spec.servers.length, scanPaths: spec.scanPaths },
  };
}
