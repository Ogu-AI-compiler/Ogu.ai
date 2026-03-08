/**
 * React Form Compiler — Runner
 *
 * 6-phase pipeline: parse → scaffold → implement → test → verify → attest
 * 12 gates. Cross-validates form fields against schema-artifact and route-artifact.
 * Produces form-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":     () => import("./gates/spec-valid.mjs"),
  "schema-valid":   () => import("./gates/schema-valid.mjs"),
  "ts-valid":       () => import("./gates/ts-valid.mjs"),
  "no-any":         () => import("./gates/no-any.mjs"),
  "labels-present": () => import("./gates/labels-present.mjs"),
  "error-display":  () => import("./gates/error-display.mjs"),
  "no-todos":       () => import("./gates/no-todos.mjs"),
  "tests-pass":     () => import("./gates/tests-pass.mjs"),
  "coverage":       () => import("./gates/coverage.mjs"),
  "submit-handler": () => import("./gates/submit-handler.mjs"),
  "cross-schema":   () => import("./gates/cross-schema.mjs"),
  "cross-route":    () => import("./gates/cross-route.mjs"),
  "contract-form":  () => import("./gates/contract-form.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "RF000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "RF000", message: `Gate threw: ${err.message}` };
  }
}

/**
 * @param {object} params
 * @param {string} params.dir           - Directory with form files
 * @param {string} [params.projectRoot] - Host project root
 * @param {object} [params.options]
 * @param {boolean} [params.options.skipTests]
 * @param {number}  [params.options.startPhase]
 * @param {function} [params.onProgress]
 */
export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/form-spec.json`;
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
    writeFileSync(`${dir}/form-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    name: spec.name,
    submitRoute: spec.submitRoute,
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
    .update((spec.name || "") + (spec.submitRoute || "") + JSON.stringify(spec.fields || []) + Date.now())
    .digest("hex")
    .slice(0, 16);

  const crossSchema = gateResults.find(g => g.id === "cross-schema");
  const crossRoute = gateResults.find(g => g.id === "cross-route");
  const coverage = gateResults.find(g => g.id === "coverage");

  return {
    schema: "form-artifact-v1",
    name: spec.name,
    fields: (spec.fields || []).map(f => ({ name: f.name, type: f.type, required: f.required ?? true })),
    submit_route: spec.submitRoute,
    auth: spec.auth,
    schema_aligned: crossSchema?.pass ?? null,
    route_aligned: crossRoute?.pass ?? null,
    coverage: coverage?.detail?.coverage ?? null,
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
