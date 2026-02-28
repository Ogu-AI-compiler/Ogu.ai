import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { repoRoot } from '../../util.mjs';

/**
 * Execution Snapshot — capture and restore full execution state.
 *
 * Two snapshot types:
 *   1. System snapshot — STATE.json, budget, feature states, audit count
 *   2. Task snapshot — per-task execution record for determinism replay
 *
 * Stored in .ogu/snapshots/{id}.json
 */

/**
 * Capture a snapshot of the current execution state.
 *
 * @param {object} opts
 * @param {string} [opts.root]
 * @param {string} [opts.label]
 * @returns {{ id: string, timestamp: string, label: string, state: object, budget: object, features: object[], hash: string }}
 */
export function captureSnapshot({ root, label } = {}) {
  root = root || repoRoot();
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  // Capture STATE.json
  let state = {};
  const statePath = join(root, '.ogu/STATE.json');
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* empty */ }
  }

  // Capture budget
  let budget = {};
  const budgetPath = join(root, '.ogu/budget/budget-state.json');
  if (existsSync(budgetPath)) {
    try { budget = JSON.parse(readFileSync(budgetPath, 'utf8')); } catch { /* empty */ }
  }

  // Capture feature states
  const features = [];
  const featDir = join(root, '.ogu/state/features');
  if (existsSync(featDir)) {
    for (const f of readdirSync(featDir).filter(f => f.endsWith('.json'))) {
      try {
        features.push(JSON.parse(readFileSync(join(featDir, f), 'utf8')));
      } catch { /* skip */ }
    }
  }

  // Audit event count
  let auditCount = 0;
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (existsSync(auditPath)) {
    auditCount = readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).length;
  }

  // Context hash
  let contextHash = '';
  const ctxPath = join(root, '.ogu/CONTEXT.md');
  if (existsSync(ctxPath)) {
    contextHash = createHash('sha256').update(readFileSync(ctxPath, 'utf8')).digest('hex').slice(0, 16);
  }

  const snapshot = {
    id,
    timestamp,
    label: label || '',
    state,
    budget,
    features,
    auditCount,
    contextHash,
  };

  // Compute hash of entire snapshot
  snapshot.hash = createHash('sha256')
    .update(JSON.stringify({ state, budget, features, auditCount, contextHash }))
    .digest('hex');

  // Save
  const snapDir = join(root, '.ogu/snapshots');
  mkdirSync(snapDir, { recursive: true });
  writeFileSync(join(snapDir, `${id}.json`), JSON.stringify(snapshot, null, 2));

  return snapshot;
}

/**
 * Load a snapshot by ID.
 *
 * @param {object} opts
 * @param {string} opts.snapshotId
 * @param {string} [opts.root]
 * @returns {object|null}
 */
export function loadSnapshot({ snapshotId, root } = {}) {
  root = root || repoRoot();
  const snapPath = join(root, '.ogu/snapshots', `${snapshotId}.json`);
  if (!existsSync(snapPath)) return null;
  return JSON.parse(readFileSync(snapPath, 'utf8'));
}

/**
 * List all snapshots, sorted newest first.
 *
 * @param {object} opts
 * @param {string} [opts.root]
 * @returns {Array<{ id: string, timestamp: string, label: string, hash: string }>}
 */
export function listSnapshots({ root } = {}) {
  root = root || repoRoot();
  const snapDir = join(root, '.ogu/snapshots');
  if (!existsSync(snapDir)) return [];

  const snapshots = [];
  for (const f of readdirSync(snapDir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(readFileSync(join(snapDir, f), 'utf8'));
      snapshots.push({
        id: data.id,
        timestamp: data.timestamp,
        label: data.label || '',
        hash: data.hash,
      });
    } catch { /* skip */ }
  }

  // Sort newest first
  snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return snapshots;
}

// ── Per-Task Execution Snapshot (Determinism) ──

function hashFile(path) {
  try { return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16); }
  catch { return 'missing'; }
}

function hashObject(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function getGitHead(root) {
  try { return execSync('git rev-parse HEAD', { cwd: root, stdio: 'pipe' }).toString().trim().slice(0, 12); }
  catch { return 'unknown'; }
}

/**
 * Begin a per-task execution snapshot. Returns a builder.
 *
 * @param {string} root
 * @param {object} opts
 * @param {string} opts.featureSlug
 * @param {string} opts.taskId
 * @param {object} [opts.modelConfig] - provider, model, fullModelId
 * @param {object} [opts.planTask] - task definition from Plan.json
 * @returns {object} Snapshot builder with setPromptHash, recordToolCall, recordNonDeterminism, finalize
 */
export function beginTaskSnapshot(root, { featureSlug, taskId, modelConfig = {}, planTask = {} }) {
  root = root || repoRoot();
  const snapshot = {
    $schema: 'ExecutionSnapshot/1.0',
    id: randomUUID(),
    capturedAt: new Date().toISOString(),
    featureSlug,
    taskId,
    environment: {
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      oguVersion: '1.0.0',
    },
    model: {
      provider: modelConfig.provider || 'anthropic',
      modelId: modelConfig.model || 'unknown',
      modelVersion: modelConfig.fullModelId || modelConfig.model || 'unknown',
      temperature: 0,
      maxTokens: modelConfig.maxTokens || 200000,
      systemPromptHash: null,
      toolsEnabled: modelConfig.tools || [],
    },
    inputs: {
      specHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Spec.md`)),
      planHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Plan.json`)),
      planTaskHash: hashObject(planTask),
      contextLockHash: hashFile(join(root, '.ogu/CONTEXT_LOCK.json')),
      orgSpecHash: hashFile(join(root, '.ogu/OrgSpec.json')),
      modelConfigHash: hashFile(join(root, '.ogu/model-config.json')),
      policiesHash: hashFile(join(root, '.ogu/policies/rules.json')),
      repoCommitBefore: getGitHead(root),
      inputArtifactHashes: {},
    },
    execution: {
      promptHash: null,
      tokensIn: 0,
      tokensOut: 0,
      toolCalls: [],
      totalToolCalls: 0,
      durationMs: 0,
      escalations: 0,
      retries: 0,
    },
    outputs: {
      repoCommitAfter: null,
      artifactsProduced: [],
      gateResults: {},
      success: false,
    },
    nonDeterministicEvents: [],
    replayable: true,
  };

  return {
    snapshot,

    setPromptHash(hash) {
      snapshot.model.systemPromptHash = hash;
      snapshot.execution.promptHash = hash;
    },

    recordToolCall(tool, inputHash, outputHash, durationMs) {
      snapshot.execution.toolCalls.push({
        order: snapshot.execution.toolCalls.length + 1,
        tool, inputHash, outputHash, durationMs,
      });
      snapshot.execution.totalToolCalls++;
    },

    recordNonDeterminism(event) {
      snapshot.nonDeterministicEvents.push(event);
      if (event.affectsOutput) snapshot.replayable = false;
    },

    finalize({ success, tokensIn, tokensOut, durationMs, artifacts, gateResults }) {
      snapshot.execution.tokensIn = tokensIn || 0;
      snapshot.execution.tokensOut = tokensOut || 0;
      snapshot.execution.durationMs = durationMs || 0;
      snapshot.outputs.repoCommitAfter = getGitHead(root);
      snapshot.outputs.artifactsProduced = artifacts || [];
      snapshot.outputs.gateResults = gateResults || {};
      snapshot.outputs.success = success;

      const dir = join(root, '.ogu/snapshots', featureSlug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${taskId}.json`), JSON.stringify(snapshot, null, 2));
      return snapshot;
    },
  };
}

/**
 * Verify replay: compare two snapshots for determinism.
 *
 * @param {object} snap1
 * @param {object} snap2
 * @returns {{ deterministic: boolean, functionallyEquivalent: boolean, diffs: object[] }}
 */
export function verifyReplay(snap1, snap2) {
  const diffs = [];

  // Input determinism
  for (const key of Object.keys(snap1.inputs || {})) {
    if (JSON.stringify(snap1.inputs[key]) !== JSON.stringify(snap2.inputs[key])) {
      diffs.push({ layer: 'input', field: key, expected: snap1.inputs[key], actual: snap2.inputs[key], severity: 'breaking' });
    }
  }

  // Model determinism
  if (snap1.model?.modelVersion !== snap2.model?.modelVersion) {
    diffs.push({ layer: 'model', field: 'modelVersion', expected: snap1.model.modelVersion, actual: snap2.model.modelVersion, severity: 'breaking' });
  }

  // Output determinism
  const ids1 = new Set((snap1.outputs?.artifactsProduced || []).map(a => a.identifier));
  const ids2 = new Set((snap2.outputs?.artifactsProduced || []).map(a => a.identifier));
  const missing = [...ids1].filter(o => !ids2.has(o));
  const extra = [...ids2].filter(o => !ids1.has(o));
  if (missing.length > 0) diffs.push({ layer: 'output', field: 'missingArtifacts', artifacts: missing, severity: 'breaking' });
  if (extra.length > 0) diffs.push({ layer: 'output', field: 'extraArtifacts', artifacts: extra, severity: 'warning' });

  return {
    deterministic: diffs.filter(d => d.severity === 'breaking').length === 0,
    functionallyEquivalent: diffs.filter(d => d.layer === 'output').length === 0,
    diffs,
  };
}

/**
 * Diff two snapshots and return human-readable differences.
 *
 * @param {object} snap1
 * @param {object} snap2
 * @returns {object[]} Array of diff entries
 */
export function diffSnapshots(snap1, snap2) {
  const result = verifyReplay(snap1, snap2);
  return result.diffs;
}
