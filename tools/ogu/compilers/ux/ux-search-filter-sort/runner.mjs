/**
 * UX Search Filter Sort Compiler — Runner
 *
 * Validates search-filter-sort-spec.json: spec structure, filter type validity,
 * no-results state, sort direction, loading state, filter persistence, and contract.
 * Produces search-filter-sort-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':               () => import('./gates/01-spec-valid.mjs'),
  'no-results-state':         () => import('./gates/02-no-results-state.mjs'),
  'filter-types-valid':       () => import('./gates/03-filter-types-valid.mjs'),
  'sort-direction':           () => import('./gates/04-sort-direction.mjs'),
  'partial-results':          () => import('./gates/05-partial-results.mjs'),
  'filter-persistence':       () => import('./gates/06-filter-persistence.mjs'),
  'contract-search-filter-sort': () => import('./gates/07-contract-search-filter-sort.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'USS000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'USS000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'search-filter-sort-spec.json');
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
    writeFileSync(join(dir, 'search-filter-sort-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const filters = Array.isArray(spec.filters) ? spec.filters : [];
  const sorts = Array.isArray(spec.sorts) ? spec.sorts : [];

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'search-filter-sort-artifact-v1',
    version: spec.version || null,
    entity: spec.entity || null,
    filter_count: filters.length,
    sort_count: sorts.length,
    persistence: spec.persistence || null,
    loading_type: spec.loadingState?.type || null,
    loading_handled_globally: spec.loadingHandledGlobally === true,
    has_no_results_state: typeof spec.noResultsState === 'object' && spec.noResultsState !== null,
    no_results_handled_globally: spec.noResultsHandledGlobally === true,
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
