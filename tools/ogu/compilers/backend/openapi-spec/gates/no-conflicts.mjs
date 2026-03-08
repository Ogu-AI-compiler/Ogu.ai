/**
 * Gate: no-conflicts
 * No duplicate operationIds. No two routes with identical method+path.
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

  const operationIds = new Map(); // operationId → source route
  const methodPaths = new Map();  // "METHOD /path" → source route
  const conflicts = [];

  for (const scanPath of scanPaths) {
    for (const artifactPath of findRouteArtifacts(scanPath)) {
      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      const routeKey = `${artifact.method} ${artifact.path}`;

      // Check method+path duplicate
      if (methodPaths.has(routeKey)) {
        conflicts.push({ type: "duplicate-route", key: routeKey, sources: [methodPaths.get(routeKey), artifactPath] });
      } else {
        methodPaths.set(routeKey, artifactPath);
      }

      // Check operationId in fragment
      const routeDir = artifactPath.replace("/route-artifact.json", "");
      const fragmentPath = `${routeDir}/openapi.json`;
      if (!existsSync(fragmentPath)) continue;

      try {
        const fragment = JSON.parse(readFileSync(fragmentPath, "utf8"));
        const paths = fragment.paths || {};

        const extractOps = (pathItem) => {
          return VALID_METHODS.map(m => pathItem[m]).filter(Boolean);
        };

        const ops = Object.keys(paths).length > 0
          ? Object.values(paths).flatMap(extractOps)
          : VALID_METHODS.map(m => fragment[m]).filter(Boolean);

        for (const op of ops) {
          if (!op.operationId) continue;
          if (operationIds.has(op.operationId)) {
            conflicts.push({ type: "duplicate-operationId", key: op.operationId, sources: [operationIds.get(op.operationId), artifactPath] });
          } else {
            operationIds.set(op.operationId, artifactPath);
          }
        }
      } catch {}
    }
  }

  if (conflicts.length) {
    return {
      pass: false,
      code: "OS004",
      message: `${conflicts.length} conflict(s) across route fragments`,
      detail: { conflicts },
    };
  }

  return { pass: true, detail: { routeCount: methodPaths.size, operationIdCount: operationIds.size } };
}
