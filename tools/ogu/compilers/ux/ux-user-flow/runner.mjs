/**
 * UX User Flow Compiler — Runner
 *
 * Validates user-flow-spec.json: node/edge structure, terminal classifications,
 * reachability, dead-ends, finite paths, decision branches, and contract.
 * Produces user-flow-artifact.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':                () => import('./gates/01-spec-valid.mjs'),
  'terminal-nodes-classified': () => import('./gates/02-terminal-nodes-classified.mjs'),
  'no-dead-ends':              () => import('./gates/03-no-dead-ends.mjs'),
  'no-orphan-nodes':           () => import('./gates/04-no-orphan-nodes.mjs'),
  'decision-branches':         () => import('./gates/05-decision-branches.mjs'),
  'edge-references-valid':     () => import('./gates/06-edge-references-valid.mjs'),
  'finite-paths':              () => import('./gates/07-finite-paths.mjs'),
  'branch-conditions-typed':   () => import('./gates/08-branch-conditions-typed.mjs'),
  'contract-user-flow':        () => import('./gates/09-contract-user-flow.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UXF000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UXF000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'user-flow-spec.json');
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
    writeFileSync(join(dir, 'user-flow-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const terminals = Array.isArray(spec.terminals) ? spec.terminals : [];
  const entryNodes = Array.isArray(spec.entryNodes) ? spec.entryNodes : [];

  const decisionCount = nodes.filter(n => n.type === 'decision').length;
  const flowId = spec.feature_id || spec.flow_id || spec.id || null;

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'user-flow-artifact-v1',
    version: spec.version || null,
    flow_id: flowId,
    node_count: nodes.length,
    edge_count: edges.length,
    terminal_count: terminals.length,
    decision_count: decisionCount,
    entry_count: entryNodes.length,
    terminal_types: nodes
      .filter(n => terminals.includes(n.id))
      .map(n => n.terminalType)
      .filter(Boolean),
    entry_nodes: entryNodes,
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
