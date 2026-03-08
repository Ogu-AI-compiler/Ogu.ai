/**
 * Gate: routes-found
 * Scan declared paths for route-artifact.json files.
 * At least one must be found.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

function findRouteArtifacts(scanDir, depth = 3) {
  const found = [];
  if (!existsSync(scanDir) || depth === 0) return found;
  try {
    const entries = readdirSync(scanDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(scanDir, entry.name);
      if (entry.isFile() && entry.name === "route-artifact.json") {
        found.push(full);
      } else if (entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("node_modules")) {
        found.push(...findRouteArtifacts(full, depth - 1));
      }
    }
  } catch {}
  return found;
}

export async function run({ dir }) {
  const specPath = `${dir}/openapi-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "OS002", message: "openapi-spec.json not found" };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const scanPaths = (spec.scanPaths || []).map(p => resolve(dir, p));

  const allArtifacts = [];
  for (const scanPath of scanPaths) {
    allArtifacts.push(...findRouteArtifacts(scanPath));
  }

  if (allArtifacts.length === 0) {
    return {
      pass: false,
      code: "OS002",
      message: "No route-artifact.json files found in declared scan paths",
      detail: { scanPaths, hint: "Compile routes first with: ogu compiler api-route <slug>" },
    };
  }

  return {
    pass: true,
    detail: { routeCount: allArtifacts.length, artifacts: allArtifacts },
  };
}
