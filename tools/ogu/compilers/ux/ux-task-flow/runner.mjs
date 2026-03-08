/**
 * UX Task Flow Compiler — Runner
 *
 * Validates task-flow-spec.json: step structure, ordering, actor assignments,
 * completion criteria, failure paths, retry caps, and abandonment recovery.
 * Produces task-flow-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':          () => import('./gates/01-spec-valid.mjs'),
  'step-order':          () => import('./gates/02-step-order.mjs'),
  'completion-criteria': () => import('./gates/03-completion-criteria.mjs'),
  'failure-paths':       () => import('./gates/04-failure-paths.mjs'),
  'retry-cap':           () => import('./gates/05-retry-cap.mjs'),
  'abandoned-recovery':  () => import('./gates/06-abandoned-recovery.mjs'),
  'step-actors':         () => import('./gates/07-step-actors.mjs'),
  'contract-task-flow':  () => import('./gates/08-contract-task-flow.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UTK000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UTK000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'task-flow-spec.json');
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
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

      const gateDef = COMPILER.gates.find(g => g.id === gateId);
      if (!result.pass && !result.skipped && gateDef?.required) {
        failed = true;
        break;
      }
    }

    if (failed) break;
  }

  const passed   = gateResults.filter(g => g.pass && !g.skipped);
  const skipped  = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed  = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(join(dir, 'task-flow-artifact.json'), JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
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
  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const criteria = Array.isArray(spec.completion_criteria) ? spec.completion_criteria : [];
  const failurePaths = Array.isArray(spec.failure_paths) ? spec.failure_paths : [];

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'task-flow-artifact-v1',
    version: spec.version || null,
    task_id: spec.task_id || null,
    step_count: steps.length,
    criteria_count: criteria.length,
    failure_path_count: failurePaths.length,
    abandonable: spec.abandonable === true,
    resume_from: spec.resumeFrom || spec.recovery_entry || null,
    actor_breakdown: {
      user: steps.filter(s => s.actor === 'user').length,
      system: steps.filter(s => s.actor === 'system').length,
      both: steps.filter(s => s.actor === 'both').length,
    },
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
