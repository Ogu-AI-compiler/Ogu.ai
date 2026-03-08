/**
 * Gate: all-routes-covered
 * Every route-artifact.json in scope must appear as a path in the assembled openapi.json.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

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
  const docPath = `${dir}/openapi.json`;
  if (!existsSync(specPath) || !existsSync(docPath)) {
    return { pass: true, skipped: true, detail: { reason: "Missing spec or assembled doc" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const scanPaths = (spec.scanPaths || []).map(p => resolve(dir, p));

  const definedPaths = new Set(Object.keys(doc.paths || {}));
  const missing = [];

  for (const scanPath of scanPaths) {
    for (const artifactPath of findRouteArtifacts(scanPath)) {
      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      if (!artifact.path) continue;

      // Normalize: /users/:id → /users/{id}
      const normalized = artifact.path.replace(/:(\w+)/g, "{$1}");
      if (!definedPaths.has(artifact.path) && !definedPaths.has(normalized)) {
        missing.push({ method: artifact.method, path: artifact.path, normalized });
      }
    }
  }

  if (missing.length) {
    return {
      pass: false,
      code: "OS006",
      message: `${missing.length} route(s) not covered in assembled spec`,
      detail: { missing },
    };
  }

  return { pass: true, detail: { coveredPaths: definedPaths.size } };
}
