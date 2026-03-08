import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

export async function run({ dir }) {
  const handlerPath = `${dir}/handler.ts`;
  const schemaPath = `${dir}/schema.ts`;
  const specPath = `${dir}/route-spec.json`;

  if (!existsSync(handlerPath)) {
    return { pass: false, code: "AR011", message: "handler.ts not found" };
  }

  const handler = readFileSync(handlerPath, "utf8");
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const violations = [];

  // Rule: named-handler — must export async function handle
  if (!/export\s+async\s+function\s+handle\b/.test(handler) &&
      !/export\s+const\s+handle\s*=\s*async/.test(handler)) {
    violations.push({ rule: "named-handler", message: "No 'export async function handle' found" });
  }

  // Rule: input-schema-export
  if (schema && !/export\s+(const|type|interface)\s+InputSchema/.test(schema)) {
    violations.push({ rule: "input-schema-export", message: "InputSchema not exported from schema.ts" });
  }

  // Rule: error-envelope — error responses use { error: ... }
  if (!/\{\s*error\s*:/.test(handler)) {
    violations.push({ rule: "error-envelope", message: "No error envelope { error: ... } found in responses" });
  }

  // Rule: async-handler + try/catch
  if (!/try\s*\{/.test(handler)) {
    violations.push({ rule: "async-handler", message: "Handler missing try/catch block" });
  }

  // Rule: auth-before-logic (for protected routes)
  if (spec.auth && spec.auth !== "none") {
    const AUTH_RE = /requireAuth|authenticate|verifyToken|req\.user|req\.auth|Bearer/;
    if (!AUTH_RE.test(handler)) {
      violations.push({ rule: "auth-before-logic", message: `Route auth="${spec.auth}" but no auth check found` });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AR011",
      message: `Route contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: handlerPath } };
}
