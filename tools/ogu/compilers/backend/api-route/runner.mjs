/**
 * API Route Compiler — Runner
 *
 * Executes the 6-phase pipeline (parse → scaffold → implement → test → verify → attest)
 * and all 11 gates. Produces route-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":       () => import("./gates/spec-valid.mjs"),
  "schema-valid":     () => import("./gates/schema-valid.mjs"),
  "auth-present":     () => import("./gates/auth-present.mjs"),
  "error-codes":      () => import("./gates/error-codes.mjs"),
  "input-validated":  () => import("./gates/input-validated.mjs"),
  "no-raw-sql":       () => import("./gates/no-raw-sql.mjs"),
  "no-todos":         () => import("./gates/no-todos.mjs"),
  "tests-pass":       () => import("./gates/tests-pass.mjs"),
  "coverage":         () => import("./gates/coverage.mjs"),
  "openapi-shape":    () => import("./gates/openapi-shape.mjs"),
  "contract-route":   () => import("./gates/contract-route.mjs"),
  "cross-schema":     () => import("./gates/cross-schema.mjs"),
  "cross-auth":       () => import("./gates/cross-auth.mjs"),
  "cross-migration":  () => import("./gates/cross-migration.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "AR000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "AR000", message: `Gate threw: ${err.message}` };
  }
}

/**
 * @param {object} params
 * @param {string} params.dir           - Directory with route files
 * @param {string} [params.projectRoot] - Host project root (for vitest/tsc)
 * @param {object} [params.options]
 * @param {boolean} [params.options.skipTests]
 * @param {number}  [params.options.startPhase]
 * @param {function} [params.onProgress]
 */
export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  // Load spec for artifact
  let spec = {};
  const specPath = `${dir}/route-spec.json`;
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
      if (options.skipTests && ["tests-pass", "coverage"].includes(gateId)) {
        gateResults.push({ id: gateId, pass: true, skipped: true, detail: { reason: "skipTests=true" } });
        onProgress?.({ id: gateId, pass: true, skipped: true });
        continue;
      }

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
  }

  const passed = gateResults.filter(g => g.pass && !g.skipped);
  const skipped = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(`${dir}/route-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    method: spec.method,
    path: spec.path,
    dir,
    phases_completed: currentPhase,
    gates: { passed: passed.length, skipped: skipped.length, failed: failures.length },
    gate_results: gateResults,
    failures,
    artifact,
    elapsed_ms: elapsed,
  };
}

function buildArtifact({ spec, gateResults, elapsed }) {
  const hash = createHash("sha256")
    .update((spec.method || "") + (spec.path || "") + JSON.stringify(gateResults) + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "route-artifact-v1",
    method: spec.method,
    path: spec.path,
    auth: spec.auth,
    input_schema: spec.input || null,
    output_schema: spec.output || null,
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    coverage: gateResults.find(g => g.id === "coverage")?.detail?.coverage ?? null,
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
