/**
 * Execution Graph Hash — deterministic proof of entire DAG execution.
 *
 * Composite hash from: plan, policy version, orgSpec, model routing decisions,
 * and all task snapshot hashes. Identical graphHash = identical results
 * (given same model responses).
 *
 * State: .ogu/state/graph-hashes/{slug}.json
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const GRAPH_HASHES_DIR = (root) => join(root, '.ogu/state/graph-hashes');

function hashCanonical(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Compute Graph Hash ────────────────────────────────────────────────

/**
 * Compute the execution graph hash for a feature.
 * Composite of 7 components proving the entire execution chain.
 */
export function computeGraphHash(root, featureSlug) {
  root = root || repoRoot();

  // 1. Plan hash
  const plan = loadPlan(root, featureSlug);
  const planHash = plan ? hashCanonical(plan) : 'no-plan';

  // 2. Policy version + AST hash
  const policy = loadPolicy(root);
  const policyVersionAtExecution = policy?.version || 0;
  const policyASTHash = hashCanonical(policy || {});

  // 3. OrgSpec version + hash
  const orgSpec = loadOrgSpec(root);
  const orgSpecVersion = orgSpec?.org?.version || '0.0.0';
  const orgSpecHash = hashCanonical(orgSpec || {});

  // 4. Model routing decisions from snapshots
  const snapshots = loadAllSnapshots(root, featureSlug);
  const modelRoutingDecisions = extractRoutingDecisions(snapshots);
  const modelDecisionSetHash = hashCanonical(modelRoutingDecisions);

  // 5. Task snapshot hashes (ordered chain)
  const taskSnapshotHashes = {};
  for (const snap of snapshots) {
    taskSnapshotHashes[snap.taskId] = snap.hash || hashCanonical(snap);
  }
  const orderedHashes = Object.entries(taskSnapshotHashes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, hash]) => hash);
  const taskSnapshotChainHash = hashCanonical(orderedHashes);

  const components = {
    planHash,
    policyVersionAtExecution,
    policyASTHash,
    orgSpecVersion,
    orgSpecHash,
    modelRoutingDecisions,
    modelDecisionSetHash,
    taskSnapshotHashes,
    taskSnapshotChainHash,
  };

  const graphHash = hashCanonical(components);

  const result = {
    $schema: 'ExecutionGraphHash/1.0',
    featureSlug,
    graphHash,
    components,
    computedAt: new Date().toISOString(),
    replayGuarantee: 'Identical graphHash = identical execution results (given same model responses)',
  };

  // Save
  const dir = GRAPH_HASHES_DIR(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${featureSlug}.json`), JSON.stringify(result, null, 2), 'utf8');

  emitAudit('graph.hash_computed', { featureSlug, graphHash }, {});

  return result;
}

/**
 * Verify a graph hash matches expected.
 */
export function verifyGraphHash(root, featureSlug, expectedHash) {
  root = root || repoRoot();
  const current = computeGraphHash(root, featureSlug);

  const match = current.graphHash === expectedHash;

  emitAudit('graph.hash_verified', {
    featureSlug,
    match,
    currentHash: current.graphHash,
    expectedHash,
  }, {});

  return {
    match,
    currentHash: current.graphHash,
    expectedHash,
    components: current.components,
  };
}

/**
 * Load a previously stored graph hash for a feature.
 */
export function loadGraphHash(root, featureSlug) {
  root = root || repoRoot();
  const path = join(GRAPH_HASHES_DIR(root), `${featureSlug}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/**
 * Diff two graph hashes — show what changed.
 */
export function diffGraphHashes(hash1, hash2) {
  if (!hash1 || !hash2) return { error: 'Both hashes required' };

  const changes = [];

  if (hash1.components.planHash !== hash2.components.planHash) {
    changes.push({ component: 'plan', hash1: hash1.components.planHash, hash2: hash2.components.planHash });
  }
  if (hash1.components.policyASTHash !== hash2.components.policyASTHash) {
    changes.push({ component: 'policy', version1: hash1.components.policyVersionAtExecution, version2: hash2.components.policyVersionAtExecution });
  }
  if (hash1.components.orgSpecHash !== hash2.components.orgSpecHash) {
    changes.push({ component: 'orgSpec', version1: hash1.components.orgSpecVersion, version2: hash2.components.orgSpecVersion });
  }
  if (hash1.components.modelDecisionSetHash !== hash2.components.modelDecisionSetHash) {
    changes.push({ component: 'modelRouting', changed: true });
  }
  if (hash1.components.taskSnapshotChainHash !== hash2.components.taskSnapshotChainHash) {
    // Find which tasks changed
    const taskChanges = [];
    const allTasks = new Set([
      ...Object.keys(hash1.components.taskSnapshotHashes || {}),
      ...Object.keys(hash2.components.taskSnapshotHashes || {}),
    ]);
    for (const taskId of allTasks) {
      const h1 = hash1.components.taskSnapshotHashes?.[taskId];
      const h2 = hash2.components.taskSnapshotHashes?.[taskId];
      if (h1 !== h2) taskChanges.push({ taskId, hash1: h1 || 'missing', hash2: h2 || 'missing' });
    }
    changes.push({ component: 'taskSnapshots', taskChanges });
  }

  return {
    match: hash1.graphHash === hash2.graphHash,
    graphHash1: hash1.graphHash,
    graphHash2: hash2.graphHash,
    changeCount: changes.length,
    changes,
  };
}

// ── Data Loaders ──────────────────────────────────────────────────────

function loadPlan(root, slug) {
  const paths = [
    join(root, `docs/vault/features/${slug}/Plan.json`),
    join(root, `docs/vault/04_Features/${slug}/Plan.json`),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch { /* skip */ }
    }
  }
  return null;
}

function loadPolicy(root) {
  const path = join(root, '.ogu/governance-policy.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function loadOrgSpec(root) {
  const path = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function loadAllSnapshots(root, slug) {
  const snapshotDir = join(root, `.ogu/snapshots/${slug}`);
  if (!existsSync(snapshotDir)) return [];
  const snapshots = [];
  try {
    for (const f of readdirSync(snapshotDir)) {
      if (!f.endsWith('.json')) continue;
      const snap = JSON.parse(readFileSync(join(snapshotDir, f), 'utf8'));
      snapshots.push(snap);
    }
  } catch { /* skip */ }
  return snapshots;
}

function extractRoutingDecisions(snapshots) {
  return snapshots
    .filter(s => s.modelRouting || s.model)
    .map(s => ({
      taskId: s.taskId,
      model: s.model || s.modelRouting?.model || 'unknown',
      provider: s.provider || s.modelRouting?.provider || 'unknown',
      capabilityUsed: s.capability || s.modelRouting?.capability || 'unknown',
    }));
}

// ── Legacy Re-exports ─────────────────────────────────────────────────

export function hashDAG(dag) {
  const tasks = [...(dag.tasks || [])];
  tasks.sort((a, b) => a.id.localeCompare(b.id));
  const canonical = tasks.map(t => ({ id: t.id, deps: [...(t.deps || [])].sort() }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function hashExecution({ dagHash, inputs, outputs } = {}) {
  return createHash('sha256').update(JSON.stringify({ dagHash, inputs, outputs })).digest('hex');
}

export function compareExecutionHashes(hash1, hash2) {
  return { match: hash1 === hash2, hash1, hash2 };
}
