import { readFileSync, existsSync } from "fs";

const REQUIRED_TOP = ["openapi", "paths"];
const VALID_METHODS = ["get", "post", "put", "patch", "delete"];

export async function run({ dir }) {
  const openapiPath = `${dir}/openapi.json`;
  if (!existsSync(openapiPath)) {
    return { pass: false, code: "AR007", message: "openapi.json not found" };
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(openapiPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "AR007", message: `openapi.json invalid JSON: ${e.message}` };
  }

  // Must have paths
  if (!doc.paths || typeof doc.paths !== "object") {
    return { pass: false, code: "AR007", message: "openapi.json missing 'paths' object" };
  }

  const pathKeys = Object.keys(doc.paths);
  if (!pathKeys.length) {
    return { pass: false, code: "AR007", message: "openapi.json has no paths defined" };
  }

  // Each path must have at least one valid method
  const violations = [];
  for (const [path, pathItem] of Object.entries(doc.paths)) {
    const methods = Object.keys(pathItem).filter(k => VALID_METHODS.includes(k));
    if (!methods.length) {
      violations.push(`${path}: no valid HTTP method defined`);
      continue;
    }

    for (const method of methods) {
      const op = pathItem[method];
      // Must have responses
      if (!op.responses || typeof op.responses !== "object") {
        violations.push(`${method.toUpperCase()} ${path}: missing 'responses'`);
      }
      // Must have at least a 200 response
      if (!op.responses?.["200"] && !op.responses?.["201"]) {
        violations.push(`${method.toUpperCase()} ${path}: missing 200/201 success response`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AR007",
      message: `OpenAPI shape issues: ${violations.length}`,
      detail: { violations },
    };
  }

  // Check openapi version (should be 3.x)
  const version = doc.openapi || doc.swagger || "";
  if (!version.startsWith("3")) {
    return {
      pass: false,
      code: "AR007",
      message: `OpenAPI version must be 3.x, got: ${version || "not specified"}`,
    };
  }

  return { pass: true, detail: { paths: pathKeys.length, version } };
}
