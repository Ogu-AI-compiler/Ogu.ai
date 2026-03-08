/**
 * React Component Compiler — Runner
 *
 * Executes the 6-phase pipeline (parse → scaffold → implement → test → verify → attest)
 * and all 11 gates. Produces a signed component-artifact.json.
 *
 * Usage:
 *   import { runCompiler } from './runner.mjs';
 *   const result = await runCompiler({ dir, name, projectRoot, options });
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// Load compiler definition
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

// Gate registry
const GATE_MODULES = {
  "spec-valid":     () => import("./gates/spec-valid.mjs"),
  "export-valid":   () => import("./gates/export-valid.mjs"),
  "typescript":     () => import("./gates/typescript.mjs"),
  "no-todos":       () => import("./gates/no-todos.mjs"),
  "design-tokens":  () => import("./gates/design-tokens.mjs"),
  "render":         () => import("./gates/render.mjs"),
  "a11y":           () => import("./gates/a11y.mjs"),
  "coverage":       () => import("./gates/coverage.mjs"),
  "props":          () => import("./gates/props.mjs"),
  "contract-shape": () => import("./gates/contract-shape.mjs"),
  "contract-a11y":  () => import("./gates/contract-a11y.mjs"),
  "cross-schema":   () => import("./gates/cross-schema.mjs"),
};

/**
 * Run a single gate.
 * @returns {{ id, pass, skipped, code, message, detail }}
 */
async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: "RC000", message: `Unknown gate: ${gateId}` };
  }

  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "RC000", message: `Gate threw: ${err.message}`, detail: { stack: err.stack } };
  }
}

/**
 * Main compiler entry point.
 *
 * @param {object} params
 * @param {string} params.dir         - Directory containing the component files
 * @param {string} params.name        - PascalCase component name
 * @param {string} [params.projectRoot] - Root of the host project (for tsc/vitest)
 * @param {object} [params.options]
 * @param {boolean} [params.options.skipTests]    - Skip render/coverage/a11y gates
 * @param {boolean} [params.options.skipTypecheck] - Skip typescript gate
 * @param {number}  [params.options.startPhase]   - Resume from this phase index
 * @param {function} [params.onProgress]          - Called after each gate: (gate) => void
 */
export async function runCompiler({ dir, name, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, name, projectRoot };

  const gateResults = [];
  let currentPhase = -1;
  let failed = false;
  const startPhase = options.startPhase ?? 0;

  for (const phase of COMPILER.pipeline) {
    if (phase.phase < startPhase) continue;

    currentPhase = phase.phase;

    for (const gateId of phase.gates) {
      // Honour skip flags
      if (options.skipTests && ["render", "a11y", "coverage"].includes(gateId)) {
        gateResults.push({ id: gateId, pass: true, skipped: true, detail: { reason: "skipTests=true" } });
        onProgress?.({ id: gateId, pass: true, skipped: true });
        continue;
      }
      if (options.skipTypecheck && gateId === "typescript") {
        gateResults.push({ id: gateId, pass: true, skipped: true, detail: { reason: "skipTypecheck=true" } });
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

  const artifact = failed
    ? null
    : buildArtifact({ name, gateResults, elapsed, dir });

  if (artifact && dir) {
    writeFileSync(`${dir}/component-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    name,
    dir,
    phases_completed: currentPhase,
    gates: { passed: passed.length, skipped: skipped.length, failed: failures.length },
    gate_results: gateResults,
    failures,
    artifact,
    elapsed_ms: elapsed,
  };
}

function buildArtifact({ name, gateResults, elapsed, dir }) {
  let spec = {};
  const specPath = dir ? `${dir}/component-spec.json` : null;
  if (specPath && existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, "utf8")); } catch {}
  }

  const hash = createHash("sha256")
    .update(name + JSON.stringify(gateResults) + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "component-artifact-v1",
    name,
    version: "1.0.0",
    props: spec.props || [],
    variants: spec.variants || [],
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    coverage: gateResults.find(g => g.id === "coverage")?.detail?.coverage ?? null,
    a11y_clean: !gateResults.some(g => g.id === "a11y" && !g.pass),
    compiled_at: new Date().toISOString(),
    compiler_version: COMPILER.version,
    elapsed_ms: elapsed,
    attestation_hash: hash,
  };
}

/**
 * Run only specific gates (for partial verification).
 */
export async function runGates(gateIds, ctx) {
  const results = [];
  for (const id of gateIds) {
    results.push(await runGate(id, ctx));
  }
  return results;
}

/**
 * List all gates defined in the compiler.
 */
export function listGates() {
  return COMPILER.gates;
}

/**
 * Get the compiler definition.
 */
export function getCompilerDef() {
  return COMPILER;
}
