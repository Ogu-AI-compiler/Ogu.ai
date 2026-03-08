/**
 * Gate: contract-openapi
 * Structural contract for the assembled OpenAPI document:
 * - info has description + contact.email
 * - every POST/PUT/PATCH documents 400
 * - every secured operation documents 401
 * - every operation documents 500
 * - no empty paths
 * - all operationIds are camelCase
 */
import { readFileSync, existsSync } from "fs";

const MUTATING = ["post", "put", "patch"];
const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
const CAMEL_RE = /^[a-z][a-zA-Z0-9]*$/;

export async function run({ dir }) {
  const docPath = `${dir}/openapi.json`;
  if (!existsSync(docPath)) {
    return { pass: false, code: "OS009", message: "openapi.json not found" };
  }

  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const violations = [];

  // Rule: info-complete
  if (!doc.info?.description) violations.push({ rule: "info-complete", message: "info.description missing" });
  if (!doc.info?.contact?.email) violations.push({ rule: "info-complete", message: "info.contact.email missing" });

  // Rule: servers-defined
  if (!Array.isArray(doc.servers) || doc.servers.length === 0 || !doc.servers[0]?.url) {
    violations.push({ rule: "servers-defined", message: "servers[] missing or has no url" });
  }

  const paths = doc.paths || {};

  // Rule: no-empty-paths
  for (const [path, pathItem] of Object.entries(paths)) {
    const hasOp = METHODS.some(m => pathItem[m]);
    if (!hasOp) violations.push({ rule: "no-empty-paths", message: `Path "${path}" has no operations` });
  }

  // Per-operation rules
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op) continue;

      const responses = op.responses || {};
      const responseCodes = Object.keys(responses);

      // Rule: errors-documented — 400 on mutating
      if (MUTATING.includes(method) && !responseCodes.includes("400")) {
        violations.push({ rule: "errors-documented", message: `${method.toUpperCase()} ${path} missing 400 response` });
      }

      // Rule: errors-documented — 401 on secured operations
      const isSecured = op.security?.length > 0 || doc.security?.length > 0;
      if (isSecured && !responseCodes.includes("401")) {
        violations.push({ rule: "errors-documented", message: `${method.toUpperCase()} ${path} is secured but missing 401 response` });
      }

      // Rule: errors-documented — 500
      if (!responseCodes.includes("500") && !responseCodes.includes("5XX")) {
        violations.push({ rule: "errors-documented", message: `${method.toUpperCase()} ${path} missing 500 response` });
      }

      // Rule: operation-ids camelCase
      if (op.operationId && !CAMEL_RE.test(op.operationId)) {
        violations.push({ rule: "operation-ids", message: `operationId "${op.operationId}" is not camelCase` });
      }

      // Rule: response-schemas — 2xx must have content (except 204)
      for (const [code, response] of Object.entries(responses)) {
        if (code.startsWith("2") && code !== "204" && !response.content) {
          violations.push({ rule: "response-schemas", message: `${method.toUpperCase()} ${path} ${code} response has no content schema` });
        }
      }
    }
  }

  if (violations.length) {
    const errors = violations.filter(v => ["info-complete", "errors-documented", "no-empty-paths", "operation-ids", "response-schemas", "servers-defined"].includes(v.rule));
    if (errors.length) {
      return {
        pass: false,
        code: "OS009",
        message: `OpenAPI contract: ${violations.length} violation(s)`,
        detail: { violations },
      };
    }
  }

  return { pass: true, detail: { checked: Object.keys(paths).length + " paths" } };
}
