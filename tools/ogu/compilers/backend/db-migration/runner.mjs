/**
 * Database Migration Compiler — Runner
 * 6 phases, 12 gates. Depends on ts-schema (schema-artifact.json).
 * Produces migration-artifact.json consumed by api-route cross-migration gate.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, "compiler.json"), "utf8"));

const GATE_MODULES = {
  "spec-valid":         () => import("./gates/spec-valid.mjs"),
  "cross-schema":       () => import("./gates/cross-schema.mjs"),
  "up-valid":           () => import("./gates/up-valid.mjs"),
  "down-valid":         () => import("./gates/down-valid.mjs"),
  "no-todos":           () => import("./gates/no-todos.mjs"),
  "no-destructive":     () => import("./gates/no-destructive.mjs"),
  "idempotent":         () => import("./gates/idempotent.mjs"),
  "rollback-complete":  () => import("./gates/rollback-complete.mjs"),
  "pk-not-nullable":    () => import("./gates/pk-not-nullable.mjs"),
  "fk-indexed":         () => import("./gates/fk-indexed.mjs"),
  "version-sequential": () => import("./gates/version-sequential.mjs"),
  "contract-migration": () => import("./gates/contract-migration.mjs"),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) return { id: gateId, pass: false, code: "DM000", message: `Unknown gate: ${gateId}` };
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: "DM000", message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = `${dir}/migration-spec.json`;
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
    writeFileSync(`${dir}/migration-artifact.json`, JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    table: spec.table,
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

function buildArtifact({ spec, gateResults, elapsed }) {
  const hash = createHash("sha256")
    .update((spec.version || "") + (spec.table || "") + JSON.stringify(spec.columns || []) + Date.now())
    .digest("hex")
    .slice(0, 16);

  return {
    schema: "migration-artifact-v1",
    version: spec.version,
    name: spec.name,
    table: spec.table,
    operation: spec.operation,
    columns: spec.columns || [],
    indexes: spec.indexes || [],
    foreignKeys: spec.foreignKeys || [],
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    schema_aligned: gateResults.find(g => g.id === "cross-schema")?.pass ?? null,
    rollback_complete: gateResults.find(g => g.id === "rollback-complete")?.pass ?? null,
    idempotent: gateResults.find(g => g.id === "idempotent")?.pass ?? null,
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
