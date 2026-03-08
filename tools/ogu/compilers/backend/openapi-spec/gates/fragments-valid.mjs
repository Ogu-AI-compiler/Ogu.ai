/**
 * Gate: fragments-valid
 * Each route's openapi.json fragment must have:
 * - A valid HTTP method
 * - A path
 * - An operationId
 * - At least one 2xx response
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

const VALID_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function findRouteArtifacts(scanDir, depth = 3) {
  const found = [];
  if (!existsSync(scanDir) || depth === 0) return found;
  try {
    for (const entry of readdirSync(scanDir, { withFileTypes: true })) {
      const full = join(scanDir, entry.name);
      if (entry.isFile() && entry.name === "route-artifact.json") found.push(full);
      else if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
        found.push(...findRouteArtifacts(full, depth - 1));
    }
  } catch {}
  return found;
}

export async function run({ dir }) {
  const specPath = `${dir}/openapi-spec.json`;
  if (!existsSync(specPath)) return { pass: true, skipped: true, detail: { reason: "No openapi-spec.json" } };

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const scanPaths = (spec.scanPaths || []).map(p => resolve(dir, p));

  const violations = [];

  for (const scanPath of scanPaths) {
    for (const artifactPath of findRouteArtifacts(scanPath)) {
      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      const routeDir = artifactPath.replace("/route-artifact.json", "");
      const fragmentPath = `${routeDir}/openapi.json`;

      if (!existsSync(fragmentPath)) {
        violations.push({ route: `${artifact.method} ${artifact.path}`, issue: "openapi.json not found in route directory" });
        continue;
      }

      let fragment;
      try { fragment = JSON.parse(readFileSync(fragmentPath, "utf8")); }
      catch (e) {
        violations.push({ route: `${artifact.method} ${artifact.path}`, issue: `openapi.json parse error: ${e.message}` });
        continue;
      }

      // Validate fragment structure: must have paths or be a path item
      const paths = fragment.paths || {};
      if (Object.keys(paths).length === 0) {
        // Maybe it's a path item directly
        const hasMethod = VALID_METHODS.some(m => fragment[m]);
        if (!hasMethod) {
          violations.push({ route: `${artifact.method} ${artifact.path}`, issue: "openapi.json has no paths and no method operations" });
          continue;
        }
        // Path item format — check operationId and responses
        const method = VALID_METHODS.find(m => fragment[m]);
        const op = fragment[method];
        if (!op.operationId) violations.push({ route: `${artifact.method} ${artifact.path}`, issue: "Missing operationId" });
        const has2xx = Object.keys(op.responses || {}).some(code => code.startsWith("2"));
        if (!has2xx) violations.push({ route: `${artifact.method} ${artifact.path}`, issue: "No 2xx response defined" });
      } else {
        for (const [path, pathItem] of Object.entries(paths)) {
          for (const method of VALID_METHODS) {
            const op = pathItem[method];
            if (!op) continue;
            if (!op.operationId) violations.push({ route: `${method.toUpperCase()} ${path}`, issue: "Missing operationId" });
            const has2xx = Object.keys(op.responses || {}).some(code => code.startsWith("2"));
            if (!has2xx) violations.push({ route: `${method.toUpperCase()} ${path}`, issue: "No 2xx response defined" });
          }
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "OS003",
      message: `${violations.length} route fragment(s) invalid`,
      detail: { violations },
    };
  }

  return { pass: true };
}
