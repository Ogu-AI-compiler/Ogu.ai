/**
 * React Page Compiler — Runner
 *
 * 6-phase pipeline: parse → scaffold → implement → test → verify → attest
 * 14 gates. Enforces typed params, loading/error/empty states, SEO, layout, and auth guard.
 * Produces page-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":    () => import("./gates/spec-valid.mjs"),
  "naming-valid":  () => import("./gates/naming-valid.mjs"),
  "ts-valid":      () => import("./gates/ts-valid.mjs"),
  "no-any":        () => import("./gates/no-any.mjs"),
  "route-params":  () => import("./gates/route-params.mjs"),
  "data-loading":  () => import("./gates/data-loading.mjs"),
  "error-boundary":() => import("./gates/error-boundary.mjs"),
  "no-todos":      () => import("./gates/no-todos.mjs"),
  "tests-pass":    () => import("./gates/tests-pass.mjs"),
  "coverage":      () => import("./gates/coverage.mjs"),
  "seo-meta":      () => import("./gates/seo-meta.mjs"),
  "empty-state":   () => import("./gates/empty-state.mjs"),
  "cross-schema":  () => import("./gates/cross-schema.mjs"),
  "contract-page": () => import("./gates/contract-page.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "RP000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "RP000", message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/page-spec.json`;
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
    writeFileSync(`${dir}/page-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    name: spec.name,
    route: spec.route,
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
    .update((spec.name || "") + (spec.route || "") + (spec.layout || "") + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "page-artifact-v1",
    name: spec.name,
    route: spec.route,
    layout: spec.layout,
    auth: spec.auth,
    params: spec.params || [],
    has_seo: gateResults.find(g => g.id === "seo-meta")?.pass ?? false,
    has_loading_state: gateResults.find(g => g.id === "data-loading")?.pass ?? false,
    has_error_boundary: gateResults.find(g => g.id === "error-boundary")?.pass ?? false,
    has_empty_state: gateResults.find(g => g.id === "empty-state")?.pass ?? false,
    schema_aligned: gateResults.find(g => g.id === "cross-schema")?.pass ?? null,
    coverage: gateResults.find(g => g.id === "coverage")?.detail?.coverage ?? null,
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
