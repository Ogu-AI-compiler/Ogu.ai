/**
 * UX Form Flow Compiler — Runner
 *
 * Validates form-flow-spec.json: field validation, server error mapping,
 * multi-step progress, draft behavior, success target, abandonment handling, and contract.
 * Produces form-flow-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':             () => import('./gates/01-spec-valid.mjs'),
  'required-fields-valid':  () => import('./gates/02-required-fields-valid.mjs'),
  'server-error-mapping':   () => import('./gates/03-server-error-mapping.mjs'),
  'multi-step-progress':    () => import('./gates/04-multi-step-progress.mjs'),
  'draft-behavior':         () => import('./gates/05-draft-behavior.mjs'),
  'success-target':         () => import('./gates/06-success-target.mjs'),
  'abandoned-handling':     () => import('./gates/07-abandoned-handling.mjs'),
  'contract-form-flow':     () => import('./gates/08-contract-form-flow.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UFF000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UFF000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'form-flow-spec.json');
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
    writeFileSync(join(dir, 'form-flow-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  const steps = Array.isArray(spec.steps) ? spec.steps : [];

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'form-flow-artifact-v1',
    version: spec.version || null,
    form_id: spec.form_id || null,
    field_count: fields.length,
    required_field_count: fields.filter(f => f.required === true).length,
    step_count: steps.length,
    multi_step: steps.length > 1,
    draft_enabled: spec.draftEnabled === true,
    submission_method: spec.submission?.method || null,
    success_target: spec.submission?.redirectTo || spec.submission?.onSuccess || null,
    abandoned_behavior: spec.abandonedBehavior || null,
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
