/**
 * Auth Middleware Compiler — Runner
 * 6 phases, 11 gates. Foundational — no upstream compiler dependencies.
 * Produces auth-artifact.json consumed by api-route cross-auth gate.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":           () => import("./gates/spec-valid.mjs"),
  "exports-valid":        () => import("./gates/exports-valid.mjs"),
  "no-hardcoded-secrets": () => import("./gates/no-hardcoded-secrets.mjs"),
  "expiry-checked":       () => import("./gates/expiry-checked.mjs"),
  "no-todos":             () => import("./gates/no-todos.mjs"),
  "error-typed":          () => import("./gates/error-typed.mjs"),
  "tests-pass":           () => import("./gates/tests-pass.mjs"),
  "coverage":             () => import("./gates/coverage.mjs"),
  "timing-safe":          () => import("./gates/timing-safe.mjs"),
  "no-secret-leak":       () => import("./gates/no-secret-leak.mjs"),
  "contract-auth":        () => import("./gates/contract-auth.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "AM000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "AM000", message: `Gate threw: ${err.message}` };
  }
}

/**
 * @param {object} params
 * @param {string} params.dir
 * @param {string} [params.projectRoot]
 * @param {object} [params.options]
 * @param {boolean} [params.options.skipTests]
 * @param {number}  [params.options.startPhase]
 * @param {function} [params.onProgress]
 */
export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/auth-spec.json`;
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
    writeFileSync(`${dir}/auth-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    strategy: spec.strategy,
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
    .update((spec.strategy || "") + JSON.stringify(spec) + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "auth-artifact-v1",
    strategy: spec.strategy,
    tokenShape: spec.tokenShape || null,
    expiry: spec.expiry || null,
    refresh: spec.refresh || false,
    exports: ["requireAuth", "optionalAuth", "signToken", "verifyToken",
              "AuthError", "TokenExpiredError", "InvalidTokenError", "MissingTokenError"],
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    coverage: gateResults.find(g => g.id === "coverage")?.detail?.coverage ?? null,
    timing_safe: gateResults.find(g => g.id === "timing-safe")?.detail?.timingSafe ?? null,
    no_secret_leak: gateResults.find(g => g.id === "no-secret-leak")?.pass ?? null,
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
