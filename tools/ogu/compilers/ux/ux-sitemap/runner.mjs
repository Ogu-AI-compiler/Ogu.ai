/**
 * UX Sitemap Compiler — Runner
 *
 * Validates sitemap-spec.json: node structure, unique IDs, parent DAG,
 * route formats, visibility values, 404 declaration, and contract.
 * Produces sitemap-artifact.json as the canonical screen inventory
 * for all downstream UX compilers.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':         () => import('./gates/01-spec-valid.mjs'),
  'unique-ids':         () => import('./gates/02-unique-ids.mjs'),
  'orphan-nodes':       () => import('./gates/03-orphan-nodes.mjs'),
  'no-circular-parent': () => import('./gates/04-no-circular-parent.mjs'),
  'valid-visibility':   () => import('./gates/05-valid-visibility.mjs'),
  'route-format':       () => import('./gates/06-route-format.mjs'),
  'root-node-limit':    () => import('./gates/07-root-node-limit.mjs'),
  'not-found-declared': () => import('./gates/08-not-found-declared.mjs'),
  'contract-sitemap':   () => import('./gates/09-contract-sitemap.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'USM000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'USM000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'sitemap-spec.json');
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

  const passed  = gateResults.filter(g => g.pass && !g.skipped);
  const skipped = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(join(dir, 'sitemap-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const rootCount = nodes.filter(n => n.parent === null || n.parent === undefined).length;
  const maxDepth = computeMaxDepth(nodes);

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'sitemap-artifact-v1',
    version: spec.version || null,
    node_count: nodes.length,
    root_count: rootCount,
    max_depth: maxDepth,
    has_not_found: nodes.some(n =>
      (typeof n.route === 'string' && (n.route === '/404' || n.route === '/not-found')) ||
      n.type === 'not-found' ||
      (typeof n.id === 'string' && (n.id.includes('404') || n.id.includes('not-found')))
    ),
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.label,
      route: n.route,
      parent: n.parent || null,
      visibility: n.visibility || 'public',
      planned: n.planned || false,
    })),
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    compiled_at: new Date().toISOString(),
    compiler_version: COMPILER.version,
    elapsed_ms: elapsed,
    attestation_hash: hash,
  };
}

function computeMaxDepth(nodes) {
  const parentMap = new Map();
  for (const node of nodes) {
    if (typeof node.id === 'string') {
      parentMap.set(node.id, node.parent || null);
    }
  }

  function depthOf(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    visited.add(id);
    const parent = parentMap.get(id);
    if (!parent || !parentMap.has(parent)) return 0;
    return 1 + depthOf(parent, visited);
  }

  let max = 0;
  for (const node of nodes) {
    if (typeof node.id === 'string') {
      const d = depthOf(node.id);
      if (d > max) max = d;
    }
  }
  return max;
}

export async function runGates(gateIds, ctx) {
  const results = [];
  for (const id of gateIds) results.push(await runGate(id, ctx));
  return results;
}

export function listGates() { return COMPILER.gates; }
export function getCompilerDef() { return COMPILER; }
