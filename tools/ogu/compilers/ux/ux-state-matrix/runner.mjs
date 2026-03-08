/**
 * UX State Matrix Compiler — Runner
 *
 * Validates state-matrix-spec.json: required states per screen, offline/unauthorized/partial
 * coverage, recovery actions on error states, and contract compliance.
 * Produces state-matrix-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':            () => import('./gates/01-spec-valid.mjs'),
  'required-states':       () => import('./gates/02-required-states.mjs'),
  'offline-state':         () => import('./gates/03-offline-state.mjs'),
  'unauthorized-state':    () => import('./gates/04-unauthorized-state.mjs'),
  'recovery-action':       () => import('./gates/05-recovery-action.mjs'),
  'no-duplicate-states':   () => import('./gates/06-no-duplicate-states.mjs'),
  'partial-state':         () => import('./gates/07-partial-state.mjs'),
  'no-todos':              () => import('./gates/08-no-todos.mjs'),
  'contract-state-matrix': () => import('./gates/09-contract-state-matrix.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UXS000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UXS000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'state-matrix-spec.json');
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
    writeFileSync(join(dir, 'state-matrix-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const screens = Array.isArray(spec.screens) ? spec.screens : [];
  const dataDependentCount = screens.filter(s =>
    Array.isArray(s.dataDependencies) && s.dataDependencies.length > 0
  ).length;
  const totalStates = screens.reduce((sum, s) =>
    sum + (Array.isArray(s.states) ? s.states.length : 0), 0
  );

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'state-matrix-artifact-v1',
    version: spec.version || null,
    screen_count: screens.length,
    data_dependent_count: dataDependentCount,
    total_states: totalStates,
    has_offline_coverage: screens.some(s =>
      Array.isArray(s.states) && s.states.some(st => (typeof st === 'string' ? st : st.type) === 'offline')
    ),
    has_unauthorized_coverage: screens.some(s =>
      Array.isArray(s.states) && s.states.some(st => (typeof st === 'string' ? st : st.type) === 'unauthorized')
    ),
    screens: screens.map(s => ({
      id: s.id,
      state_types: Array.isArray(s.states)
        ? s.states.map(st => typeof st === 'string' ? st : st.type).filter(Boolean)
        : [],
      data_dependency_count: Array.isArray(s.dataDependencies) ? s.dataDependencies.length : 0,
      auth: s.auth || false,
      network_dependent: s.networkDependent || false,
    })),
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
