/**
 * React Hook Compiler — Runner
 *
 * 6-phase pipeline: parse → scaffold → implement → test → verify → attest
 * 11 gates. Enforces Rules of Hooks, cleanup, stable deps, and contract.
 * Produces hook-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":           () => import("./gates/spec-valid.mjs"),
  "naming-valid":         () => import("./gates/naming-valid.mjs"),
  "ts-valid":             () => import("./gates/ts-valid.mjs"),
  "no-any":               () => import("./gates/no-any.mjs"),
  "no-conditional-hooks": () => import("./gates/no-conditional-hooks.mjs"),
  "cleanup-effects":      () => import("./gates/cleanup-effects.mjs"),
  "no-todos":             () => import("./gates/no-todos.mjs"),
  "tests-pass":           () => import("./gates/tests-pass.mjs"),
  "coverage":             () => import("./gates/coverage.mjs"),
  "stable-deps":          () => import("./gates/stable-deps.mjs"),
  "cross-schema":         () => import("./gates/cross-schema.mjs"),
  "contract-hook":        () => import("./gates/contract-hook.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "RH000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "RH000", message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/hook-spec.json`;
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

  const artifact = failed ? null : buildArtifact({ spec, dir, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(`${dir}/hook-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    name: spec.name,
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
  // Find actual hook filename
  let hookFile = null;
  try {
    hookFile = readdirSync(dir).find(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test.")) || null;
  } catch {}

  const hash = createHash("sha256")
    .update((spec.name || "") + (spec.purpose || "") + JSON.stringify(spec.returns || {}) + Date.now())
    .digest("hex")
    .slice(0, 16);

  const crossSchema = gateResults.find(g => g.id === "cross-schema");
  const coverage = gateResults.find(g => g.id === "coverage");

  return {
    schema: "hook-artifact-v1",
    name: spec.name,
    purpose: spec.purpose,
    file: hookFile,
    returns: spec.returns || {},
    has_side_effects: !!(spec.sideEffects || spec.async || spec.fetches),
    is_async: !!(spec.async || spec.fetches),
    schema_aligned: crossSchema?.pass ?? null,
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
