/**
 * OpenAPI Spec Compiler — Runner
 *
 * Aggregator compiler: collects route-artifact.json files, validates fragments,
 * assembles a complete OpenAPI 3.1 document, and produces openapi-artifact.json.
 *
 * Unlike other compilers, this one ASSEMBLES the openapi.json itself during the
 * assemble phase (between validate-fragments and verify gates).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":        () => import("./gates/spec-valid.mjs"),
  "routes-found":      () => import("./gates/routes-found.mjs"),
  "fragments-valid":   () => import("./gates/fragments-valid.mjs"),
  "no-conflicts":      () => import("./gates/no-conflicts.mjs"),
  "openapi-valid":     () => import("./gates/openapi-valid.mjs"),
  "all-routes-covered":() => import("./gates/all-routes-covered.mjs"),
  "schemas-referenced":() => import("./gates/schemas-referenced.mjs"),
  "auth-schemes":      () => import("./gates/auth-schemes.mjs"),
  "contract-openapi":  () => import("./gates/contract-openapi.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "OS000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "OS000", message: `Gate threw: ${err.message}` };
  }
}

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

/**
 * Assemble openapi.json from route fragments.
 * Runs between validate-fragments and verify phases.
 */
function assembleDocument(dir) {
  const specPath = `${dir}/openapi-spec.json`;
  if (!existsSync(specPath)) return;

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const scanPaths = (spec.scanPaths || []).map(p => resolve(dir, p));

  const paths = {};
  const schemas = {};
  const securitySchemes = {};

  for (const scanPath of scanPaths) {
    for (const artifactPath of findRouteArtifacts(scanPath)) {
      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      const routeDir = artifactPath.replace("/route-artifact.json", "");
      const fragmentPath = `${routeDir}/openapi.json`;

      if (!existsSync(fragmentPath)) continue;

      try {
        const fragment = JSON.parse(readFileSync(fragmentPath, "utf8"));

        // Merge paths
        if (fragment.paths) {
          for (const [path, pathItem] of Object.entries(fragment.paths)) {
            if (!paths[path]) paths[path] = {};
            Object.assign(paths[path], pathItem);
          }
        } else {
          // Path item format — use artifact.path
          const routePath = artifact.path?.replace(/:(\w+)/g, "{$1}") || "/unknown";
          if (!paths[routePath]) paths[routePath] = {};
          const method = artifact.method?.toLowerCase();
          if (method && fragment[method]) paths[routePath][method] = fragment[method];
        }

        // Merge component schemas
        if (fragment.components?.schemas) Object.assign(schemas, fragment.components.schemas);
        if (fragment.components?.securitySchemes) Object.assign(securitySchemes, fragment.components.securitySchemes);
      } catch {}
    }
  }

  // Add built-in error schemas if referenced
  if (!schemas.Error) {
    schemas.Error = {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
      required: ["code", "message"],
    };
  }

  // Add bearer auth if any route uses auth
  if (!securitySchemes.bearerAuth && Object.values(paths).some(pi =>
    Object.values(pi).some(op => op?.security?.some?.(s => s.bearerAuth !== undefined))
  )) {
    securitySchemes.bearerAuth = { type: "http", scheme: "bearer", bearerFormat: "JWT" };
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: spec.title,
      version: spec.version,
      description: spec.description || `${spec.title} API`,
      contact: spec.contact || { email: "api@example.com" },
    },
    servers: spec.servers,
    paths,
    components: {
      schemas,
      securitySchemes,
    },
  };

  writeFileSync(`${dir}/openapi.json`, JSON.stringify(doc, null, 2));
  return doc;
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/openapi-spec.json`;
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, "utf8")); } catch {}
  }

  const gateResults = [];
  let currentPhase = -1;
  let failed = false;
  const startPhase = options.startPhase ?? 0;

  for (const phase of COMPILER.pipeline) {
    if (phase.phase < startPhase) continue;
    currentPhase = phase.phase;

    for (const gateId of phase.gates) {
      const result = await runGate(gateId, ctx);
      gateResults.push(result);
      onProgress?.(result);

      const gateSpec = COMPILER.gates.find(g => g.id === gateId);
      if (!result.pass && !result.skipped && gateSpec?.required) {
        failed = true;
        break;
      }
    }

    if (failed) break;

    // After validate-fragments phase (phase 1), assemble the document
    if (phase.phase === 1 && !failed) {
      assembleDocument(dir);
    }
  }

  const passed = gateResults.filter(g => g.pass && !g.skipped);
  const skipped = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, dir, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(`${dir}/openapi-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    title: spec.title,
    version: spec.version,
    dir,
    phases_completed: currentPhase,
    gates: { passed: passed.length, skipped: skipped.length, failed: failures.length },
    gate_results: gateResults,
    failures,
    artifact,
    elapsed_ms: elapsed,
  };
}

function buildArtifact({ spec, dir, gateResults, elapsed }) {
  let pathCount = 0;
  let routeCount = 0;

  const docPath = `${dir}/openapi.json`;
  if (existsSync(docPath)) {
    try {
      const doc = JSON.parse(readFileSync(docPath, "utf8"));
      pathCount = Object.keys(doc.paths || {}).length;
    } catch {}
  }

  const routesFoundGate = gateResults.find(g => g.id === "routes-found");
  routeCount = routesFoundGate?.detail?.routeCount ?? 0;

  const hash = createHash("sha256")
    .update((spec.title || "") + (spec.version || "") + pathCount + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "openapi-artifact-v1",
    title: spec.title,
    version: spec.version,
    openapi_version: "3.1.0",
    route_count: routeCount,
    path_count: pathCount,
    servers: spec.servers || [],
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    compiled_at: new Date().toISOString(),
    compiler_version: COMPILER.version,
    elapsed_ms: elapsed,
    attestation_hash: hash,
  };
}

export async function runGates(gateIds, ctx) {
  const results = [];
  for (const id of gateIds) results.push(await runGate(id, ctx));
  return results;
}

export function listGates() { return COMPILER.gates; }
export function getCompilerDef() { return COMPILER; }
