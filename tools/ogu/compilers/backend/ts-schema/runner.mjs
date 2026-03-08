/**
 * TypeScript Schema Compiler — Runner
 *
 * 6-phase pipeline: parse → scaffold → implement → cross-check → verify → attest
 * 12 gates. Produces schema-artifact.json with full field registry.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":              () => import("./gates/spec-valid.mjs"),
  "zod-valid":               () => import("./gates/zod-valid.mjs"),
  "no-any":                  () => import("./gates/no-any.mjs"),
  "types-exported":          () => import("./gates/types-exported.mjs"),
  "no-todos":                () => import("./gates/no-todos.mjs"),
  "exhaustive-unions":       () => import("./gates/exhaustive-unions.mjs"),
  "refinements-documented":  () => import("./gates/refinements-documented.mjs"),
  "field-coverage":          () => import("./gates/field-coverage.mjs"),
  "openapi-compatible":      () => import("./gates/openapi-compatible.mjs"),
  "no-circular":             () => import("./gates/no-circular.mjs"),
  "contract-schema":         () => import("./gates/contract-schema.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "SC000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "SC000", message: `Gate threw: ${err.message}`, detail: { stack: err.stack } };
  }
}

/**
 * @param {object} params
 * @param {string} params.dir           - Directory containing schema files
 * @param {string} [params.projectRoot] - Host project root
 * @param {object} [params.options]
 * @param {boolean} [params.options.skipCrossCheck] - Skip cross-component/cross-route gates
 * @param {number}  [params.options.startPhase]
 * @param {function} [params.onProgress]
 */
export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/schema-spec.json`;
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
  }

  const passed = gateResults.filter(g => g.pass && !g.skipped);
  const skipped = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(`${dir}/schema-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    entity: spec.entity,
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
    .update((spec.entity || "") + JSON.stringify(spec.fields || []) + Date.now())
    .digest("hex")
    .slice(0, 16);

  const crossComponentGate = gateResults.find(g => g.id === "cross-component");
  const crossRouteGate = gateResults.find(g => g.id === "cross-route");

  return {
    schema: "schema-artifact-v1",
    entity: spec.entity,
    fields: spec.fields || [],
    relationships: spec.relationships || [],
    schemas_exported: gateResults.find(g => g.id === "zod-valid")?.detail?.schemas || [],
    types_exported: gateResults.find(g => g.id === "types-exported")?.detail?.schemas || 0,
    openapi_path: "openapi-schema.json",
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    cross_component_aligned: crossComponentGate?.pass ?? null,
    cross_route_aligned: crossRouteGate?.pass ?? null,
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
