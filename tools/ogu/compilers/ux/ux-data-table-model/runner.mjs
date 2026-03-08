/**
 * UX Data Table Model Compiler — Runner
 *
 * Validates data-table-spec.json: column definitions, pagination, selection state,
 * loading state, empty state, sortable column alignment, bulk action confirmations, and contract.
 * Produces data-table-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':               () => import('./gates/01-spec-valid.mjs'),
  'paging-required':          () => import('./gates/02-paging-required.mjs'),
  'selection-state':          () => import('./gates/03-selection-state.mjs'),
  'loading-state':            () => import('./gates/04-loading-state.mjs'),
  'empty-table':              () => import('./gates/05-empty-table.mjs'),
  'sortable-columns-valid':   () => import('./gates/06-sortable-columns-valid.mjs'),
  'bulk-actions-confirmation':() => import('./gates/07-bulk-actions-confirmation.mjs'),
  'contract-data-table':      () => import('./gates/08-contract-data-table.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UDT000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UDT000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'data-table-spec.json');
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
    writeFileSync(join(dir, 'data-table-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const columns = Array.isArray(spec.columns) ? spec.columns : [];
  const bulkActions = spec.selectionState?.bulkActions;

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'data-table-artifact-v1',
    version: spec.version || null,
    table_id: spec.table_id || null,
    column_count: columns.length,
    sortable_column_count: columns.filter(c => c.sortable === true).length,
    selectable: spec.selectable === true,
    loading_state: spec.loadingState || null,
    page_size: spec.pagination?.pageSize ?? null,
    estimated_row_count: spec.estimatedRowCount ?? null,
    has_empty_state: typeof spec.emptyState === 'object' && spec.emptyState !== null,
    bulk_action_count: Array.isArray(bulkActions) ? bulkActions.length : 0,
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
