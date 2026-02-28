/**
 * Artifact Store — structured output passing between tasks.
 *
 * Each task produces artifacts (files, schemas, APIs, etc.) that downstream tasks consume.
 * Storage: .ogu/artifacts/{featureSlug}/{taskId}.json
 * Index:   .ogu/artifacts/{featureSlug}/index.json
 *
 * Schema per spec:
 *   { id, type, identifier, producedBy: { agentId, taskId, featureSlug },
 *     files: [{ path, hash }], dependencies: string[],
 *     producedAt, verified, verifiedAt, verifiedBy }
 *
 * Core functions:
 *   storeArtifact     — Save artifact with full schema + update index
 *   loadArtifact      — Load single artifact by taskId
 *   resolveArtifact   — Resolve by identifier (returns verified or unverified)
 *   verifyArtifact    — Mark artifact as verified after gate passes
 *   listArtifacts     — List all task artifacts for a feature
 *   checkDependencies — Check if all dependencies of a task are verified
 *   getArtifactIndex  — Load the feature artifact index
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

const ARTIFACTS_DIR = () => join(repoRoot(), '.ogu/artifacts');

/** Valid artifact types */
const ARTIFACT_TYPES = ['FILE', 'API', 'ROUTE', 'COMPONENT', 'SCHEMA', 'CONTRACT', 'TOKEN', 'TEST'];

/**
 * Store an artifact produced by a task.
 *
 * @param {string} taskId — Task identifier
 * @param {string} featureSlug — Feature slug
 * @param {object} data — Artifact data
 * @param {string} [data.type='FILE'] — Artifact type (FILE|API|ROUTE|COMPONENT|SCHEMA|CONTRACT|TOKEN|TEST)
 * @param {string} [data.identifier] — Unique identifier (e.g. "API:/users POST", "SCHEMA:users")
 * @param {Array<{path: string, content?: string, hash?: string}>} [data.files] — Output files
 * @param {string[]} [data.dependencies] — Artifact identifiers this depends on
 * @param {object} [data.metadata] — Task-specific metadata (roleId, model, tier, tokensUsed, cost)
 * @param {string} [data.agentId] — Agent role that produced this
 * @param {string} [root] — Override repo root (for testing)
 * @returns {object} The stored artifact record
 */
export function storeArtifact(taskId, featureSlug, data, root = null) {
  const baseDir = root ? join(root, '.ogu/artifacts') : ARTIFACTS_DIR();
  const dir = join(baseDir, featureSlug);
  mkdirSync(dir, { recursive: true });

  const type = data.type || 'FILE';
  const identifier = data.identifier || `${type}:${taskId}`;

  // Compute file hashes
  const files = (data.files || []).map(f => ({
    path: f.path,
    hash: f.hash || (f.content ? hashContent(f.content) : null),
  }));

  const artifact = {
    id: randomUUID(),
    type,
    identifier,
    producedBy: {
      agentId: data.agentId || data.metadata?.roleId || 'unknown',
      taskId,
      featureSlug,
    },
    files,
    dependencies: data.dependencies || [],
    producedAt: new Date().toISOString(),
    verified: false,
    verifiedAt: null,
    verifiedBy: null,
    metadata: data.metadata || {},
  };

  // Write artifact record
  writeFileSync(join(dir, `${taskId}.json`), JSON.stringify(artifact, null, 2), 'utf8');

  // Update index
  updateArtifactIndex(baseDir, featureSlug, artifact);

  return artifact;
}

/**
 * Load artifact record for a task.
 *
 * @param {string} taskId
 * @param {string} featureSlug
 * @param {string} [root] — Override repo root
 * @returns {object|null} Artifact record or null
 */
export function loadArtifact(taskId, featureSlug, root = null) {
  const baseDir = root ? join(root, '.ogu/artifacts') : ARTIFACTS_DIR();
  const filePath = join(baseDir, featureSlug, `${taskId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Backward-compatible alias
export const loadArtifacts = loadArtifact;

/**
 * Resolve an artifact by identifier within a feature.
 * Searches the artifact index for a matching identifier.
 *
 * @param {string} featureSlug
 * @param {string} identifier — e.g. "API:/users POST", "SCHEMA:users"
 * @param {string} [root] — Override repo root
 * @returns {object|null} Artifact record or null
 */
export function resolveArtifact(featureSlug, identifier, root = null) {
  const index = getArtifactIndex(featureSlug, root);
  if (!index || !index.artifacts) return null;
  const entry = index.artifacts[identifier];
  if (!entry) return null;
  // Load the full artifact record
  return loadArtifact(entry.taskId, featureSlug, root);
}

/**
 * Mark an artifact as verified (after gates pass).
 *
 * @param {string} taskId
 * @param {string} featureSlug
 * @param {string} verifiedBy — Who/what verified (e.g. "gate:typecheck", "human:user@org")
 * @param {string} [root]
 * @returns {{ verified: boolean, error?: string }}
 */
export function verifyArtifact(taskId, featureSlug, verifiedBy, root = null) {
  const artifact = loadArtifact(taskId, featureSlug, root);
  if (!artifact) return { verified: false, error: 'Artifact not found' };

  artifact.verified = true;
  artifact.verifiedAt = new Date().toISOString();
  artifact.verifiedBy = verifiedBy;

  const baseDir = root ? join(root, '.ogu/artifacts') : ARTIFACTS_DIR();
  writeFileSync(join(baseDir, featureSlug, `${taskId}.json`), JSON.stringify(artifact, null, 2), 'utf8');

  // Update index
  updateArtifactIndex(baseDir, featureSlug, artifact);

  return { verified: true };
}

/**
 * Check if all dependencies of a task's artifact are verified.
 *
 * @param {string} taskId
 * @param {string} featureSlug
 * @param {string} [root]
 * @returns {{ ready: boolean, missing: string[], unverified: string[] }}
 */
export function checkDependencies(taskId, featureSlug, root = null) {
  const artifact = loadArtifact(taskId, featureSlug, root);
  if (!artifact) return { ready: false, missing: [], unverified: [], error: 'Artifact not found' };

  const deps = artifact.dependencies || [];
  if (deps.length === 0) return { ready: true, missing: [], unverified: [] };

  const missing = [];
  const unverified = [];

  for (const dep of deps) {
    const resolved = resolveArtifact(featureSlug, dep, root);
    if (!resolved) {
      missing.push(dep);
    } else if (!resolved.verified) {
      unverified.push(dep);
    }
  }

  return {
    ready: missing.length === 0 && unverified.length === 0,
    missing,
    unverified,
  };
}

/**
 * Check if all upstream artifacts for a set of tasks are ready.
 *
 * @param {string} featureSlug
 * @param {Array<{ id: string, dependsOn?: string[] }>} tasks — task list with dependencies
 * @param {string} [root]
 * @returns {{ ready: boolean, blocked: Array<{ taskId: string, missing: string[], unverified: string[] }> }}
 */
export function checkAllDependencies(featureSlug, tasks, root = null) {
  const blocked = [];

  for (const task of tasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) continue;

    // For each dependency task, check if its artifact is verified
    const missing = [];
    const unverified = [];

    for (const depTaskId of task.dependsOn) {
      const artifact = loadArtifact(depTaskId, featureSlug, root);
      if (!artifact) {
        missing.push(depTaskId);
      } else if (!artifact.verified) {
        unverified.push(depTaskId);
      }
    }

    if (missing.length > 0 || unverified.length > 0) {
      blocked.push({ taskId: task.id, missing, unverified });
    }
  }

  return {
    ready: blocked.length === 0,
    blocked,
  };
}

/**
 * List all task IDs that have stored artifacts for a feature.
 *
 * @param {string} featureSlug
 * @param {string} [root]
 * @returns {string[]} Task IDs
 */
export function listArtifacts(featureSlug, root = null) {
  const baseDir = root ? join(root, '.ogu/artifacts') : ARTIFACTS_DIR();
  const dir = join(baseDir, featureSlug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .map(f => f.replace('.json', ''))
    .sort();
}

/**
 * Load the artifact index for a feature.
 *
 * @param {string} featureSlug
 * @param {string} [root]
 * @returns {object|null} — { artifacts: { [identifier]: { taskId, type, verified, producedAt } } }
 */
export function getArtifactIndex(featureSlug, root = null) {
  const baseDir = root ? join(root, '.ogu/artifacts') : ARTIFACTS_DIR();
  const indexPath = join(baseDir, featureSlug, 'index.json');
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Verify artifact files exist on disk and hashes match.
 *
 * @param {string} taskId
 * @param {string} featureSlug
 * @param {string} [root] — repo root for resolving file paths
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function verifyArtifactFiles(taskId, featureSlug, root = null) {
  const repoRootPath = root || repoRoot();
  const artifact = loadArtifact(taskId, featureSlug, root);
  if (!artifact) return { valid: false, errors: ['Artifact not found'] };

  const errors = [];
  for (const file of artifact.files) {
    if (!file.path) continue;
    const fullPath = join(repoRootPath, file.path);
    if (!existsSync(fullPath)) {
      errors.push(`File not found: ${file.path}`);
      continue;
    }
    if (file.hash) {
      const content = readFileSync(fullPath, 'utf8');
      const actualHash = hashContent(content);
      if (actualHash !== file.hash) {
        errors.push(`Hash mismatch for ${file.path}: expected ${file.hash.slice(0, 12)}..., got ${actualHash.slice(0, 12)}...`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Internal helpers ──

/**
 * Update the feature artifact index.
 */
function updateArtifactIndex(baseDir, featureSlug, artifact) {
  const dir = join(baseDir, featureSlug);
  const indexPath = join(dir, 'index.json');

  let index;
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch {
      index = { artifacts: {} };
    }
  } else {
    index = { artifacts: {} };
  }

  index.artifacts[artifact.identifier] = {
    id: artifact.id,
    taskId: artifact.producedBy.taskId,
    type: artifact.type,
    verified: artifact.verified,
    verifiedAt: artifact.verifiedAt,
    verifiedBy: artifact.verifiedBy,
    producedAt: artifact.producedAt,
  };

  index.updatedAt = new Date().toISOString();
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * SHA-256 hash of content.
 */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

export { ARTIFACT_TYPES };
