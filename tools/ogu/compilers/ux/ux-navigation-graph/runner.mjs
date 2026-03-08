/**
 * UX Navigation Graph Compiler — Runner
 *
 * Validates navigation-spec.json: node structure, entry points, transition targets,
 * reachability, back-paths, guards, 404 handling, and cycle detection.
 * Produces navigation-artifact.json consumed by user-flow and permission-branch compilers.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':               () => import('./gates/01-spec-valid.mjs'),
  'entry-points-valid':       () => import('./gates/02-entry-points-valid.mjs'),
  'no-orphan-routes':         () => import('./gates/03-no-orphan-routes.mjs'),
  'guards-declared':          () => import('./gates/04-guards-declared.mjs'),
  'back-path-valid':          () => import('./gates/05-back-path-valid.mjs'),
  'transition-targets-valid': () => import('./gates/06-transition-targets-valid.mjs'),
  'not-found-reachable':      () => import('./gates/07-not-found-reachable.mjs'),
  'no-cyclic-trap':           () => import('./gates/08-no-cyclic-trap.mjs'),
  'contract-navigation':      () => import('./gates/09-contract-navigation.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UNG000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UNG000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'navigation-spec.json');
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
    writeFileSync(join(dir, 'navigation-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const entryPoints = Array.isArray(spec.entryPoints) ? spec.entryPoints : [];

  const transitionCount = nodes.reduce((sum, n) => {
    return sum + (Array.isArray(n.transitions) ? n.transitions.length : 0);
  }, 0);

  const protectedCount = nodes.filter(n => n.auth === true || (n.visibility && n.visibility !== 'public')).length;

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'navigation-artifact-v1',
    version: spec.version || null,
    node_count: nodes.length,
    entry_count: entryPoints.length,
    transition_count: transitionCount,
    protected_count: protectedCount,
    has_not_found: nodes.some(n =>
      n.type === 'not-found' ||
      (typeof n.route === 'string' && (n.route === '/404' || n.route === '/not-found')) ||
      (typeof n.id === 'string' && (n.id.includes('404') || n.id.includes('not-found')))
    ),
    entry_points: entryPoints,
    nodes: nodes.map(n => ({
      id: n.id,
      auth: n.auth || false,
      visibility: n.visibility || 'public',
      transition_count: Array.isArray(n.transitions) ? n.transitions.length : 0,
      has_guard: !!(n.guard || n.redirectOnFail),
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
