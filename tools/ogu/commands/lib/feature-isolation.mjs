/**
 * Feature Isolation — full envelope system.
 *
 * Budget isolation, concurrency isolation, blast radius enforcement,
 * failure containment. Each feature operates within its envelope.
 *
 * Feature envelope is checked BEFORE resource governor.
 * Feature cannot exceed its envelope even if global resources are available.
 * Failure in one feature NEVER propagates to another.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ── Legacy exports (backwards compat) ──────────────────────────────────

const SHARED_PATHS = [
  'src/', 'public/', 'styles/', 'lib/', 'utils/', 'components/',
  'pages/', 'app/', 'tests/', 'package.json', 'tsconfig.json',
  'vite.config', 'next.config', 'tailwind.config',
  '.ogu/STATE.json', '.ogu/CONTEXT.md', '.ogu/MEMORY.md', 'tools/',
];

const FEATURE_SCOPED_PREFIXES = ['docs/vault/features/'];

export function computeIsolationBoundary({ featureSlug, root } = {}) {
  root = root || repoRoot();
  const ownPaths = FEATURE_SCOPED_PREFIXES.map(p => `${p}${featureSlug}/`);
  return {
    featureSlug,
    allowedPaths: [...SHARED_PATHS, ...ownPaths],
    blockedPrefixes: FEATURE_SCOPED_PREFIXES,
    isolationLevel: 'filesystem',
  };
}

export function checkPathAccess({ path, boundary } = {}) {
  const normalizedPath = path.replace(/^\/+/, '');
  for (const prefix of boundary.blockedPrefixes) {
    if (normalizedPath.startsWith(prefix)) {
      const featurePath = `${prefix}${boundary.featureSlug}/`;
      if (normalizedPath.startsWith(featurePath)) {
        return { permitted: true, reason: 'own feature path' };
      }
      return { permitted: false, reason: `cross-feature access: ${normalizedPath} belongs to another feature` };
    }
  }
  for (const shared of boundary.allowedPaths) {
    if (normalizedPath === shared || normalizedPath.startsWith(shared)) {
      return { permitted: true, reason: 'shared path' };
    }
  }
  return { permitted: true, reason: 'unscoped path' };
}

// ── Feature Envelope System ─────────────────────────────────────────────

const ENVELOPE_PATH = (root, slug) => join(root, `docs/vault/04_Features/${slug}/envelope.json`);

/**
 * Create feature envelope at allocation time.
 */
export function createEnvelope(root, featureSlug, { plan, orgBudget } = {}) {
  root = root || repoRoot();
  const tasks = plan?.tasks || [];
  const taskCount = Math.max(tasks.length, 1);
  const estimatedCost = tasks.reduce((sum, t) => sum + (t.estimatedCost || 1), 0);

  // Compute blast radius from plan outputs
  const allowedPaths = new Set();
  const blockedPaths = new Set(['.env*', '.ogu/secrets*', '*.pem', '*.key']);

  for (const task of tasks) {
    for (const output of (task.outputs || [])) {
      if (output.path) {
        // Allow the directory containing the output
        const dir = output.path.split('/').slice(0, -1).join('/');
        if (dir) allowedPaths.add(`${dir}/**`);
      }
    }
  }

  // Always allow feature's own directory
  allowedPaths.add(`docs/vault/04_Features/${featureSlug}/**`);

  const envelope = {
    $schema: 'FeatureEnvelope/1.0',
    featureSlug,
    budget: {
      maxTotalCost: Math.max(estimatedCost * 1.5, 10),
      maxCostPerTask: Math.max((estimatedCost / taskCount) * 2, 2),
      dailyLimit: Math.max(estimatedCost * 0.5, 5),
      currency: 'USD',
      spent: 0,
      remaining: Math.max(estimatedCost * 1.5, 10),
      alerts: [
        { threshold: 0.5, action: 'notify_pm', fired: false },
        { threshold: 0.8, action: 'notify_cto', fired: false },
        { threshold: 0.95, action: 'auto_suspend', fired: false },
      ],
      inheritFromOrg: true,
    },
    concurrency: {
      maxParallelAgents: Math.min(Math.ceil(taskCount / 3), 4),
      maxParallelModelCalls: Math.min(Math.ceil(taskCount / 3), 4),
      maxParallelBuilds: 1,
      maxWorktrees: 1,
    },
    policyOverrides: [],
    blastRadius: {
      maxFiles: Math.max(taskCount * 5, 20),
      allowedPaths: [...allowedPaths, 'src/**', 'tests/**'],
      blockedPaths: [...blockedPaths],
      maxProcesses: 5,
      maxMemoryMb: 2048,
      networkEgress: 'deny_all',
    },
    failureContainment: {
      maxConsecutiveFailures: 3,
      maxTotalFailures: taskCount * 2,
      consecutiveFailures: 0,
      totalFailures: 0,
      onConsecutiveFailure: 'pause_and_escalate',
      onTotalFailure: 'auto_suspend',
    },
    createdAt: new Date().toISOString(),
    createdBy: 'kadima',
  };

  const dir = join(root, `docs/vault/04_Features/${featureSlug}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ENVELOPE_PATH(root, featureSlug), JSON.stringify(envelope, null, 2), 'utf8');

  return envelope;
}

/**
 * Load feature envelope.
 */
export function loadEnvelope(root, featureSlug) {
  root = root || repoRoot();
  const path = ENVELOPE_PATH(root, featureSlug);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/**
 * Save feature envelope.
 */
export function saveEnvelope(root, featureSlug, envelope) {
  root = root || repoRoot();
  const dir = join(root, `docs/vault/04_Features/${featureSlug}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ENVELOPE_PATH(root, featureSlug), JSON.stringify(envelope, null, 2), 'utf8');
}

/**
 * Check if a task can execute within its feature's envelope.
 * Called BEFORE acquireResource().
 *
 * @returns {{ allowed: boolean, violations: Array, envelope: object }}
 */
export function checkEnvelope(root, featureSlug, { taskCost = 0, resourceType = 'model_call', filesTouch = [] } = {}) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);

  if (!envelope) {
    // No envelope = no restriction (backwards compat)
    return { allowed: true, violations: [], envelope: null };
  }

  const violations = [];

  // Budget check
  if (taskCost > 0) {
    if (envelope.budget.spent + taskCost > envelope.budget.maxTotalCost) {
      violations.push({
        type: 'budget_exceeded',
        error: `OGU3801: Feature '${featureSlug}' budget exceeded. Spent: $${envelope.budget.spent.toFixed(2)}, Task: $${taskCost.toFixed(2)}, Max: $${envelope.budget.maxTotalCost.toFixed(2)}`,
      });
    }

    if (taskCost > envelope.budget.maxCostPerTask) {
      violations.push({
        type: 'task_too_expensive',
        error: `OGU3802: Task cost $${taskCost.toFixed(2)} exceeds per-task limit $${envelope.budget.maxCostPerTask.toFixed(2)}`,
      });
    }
  }

  // Blast radius check
  if (filesTouch.length > 0) {
    for (const file of filesTouch) {
      const relPath = file.startsWith('/') ? relative(root, file) : file;

      // Check blocked paths
      for (const pattern of (envelope.blastRadius.blockedPaths || [])) {
        if (matchGlob(relPath, pattern)) {
          violations.push({
            type: 'blocked_path',
            error: `OGU3805: File '${relPath}' is in feature's blocked paths`,
          });
        }
      }

      // Check allowed paths
      const inAllowed = (envelope.blastRadius.allowedPaths || []).some(p => matchGlob(relPath, p));
      if (!inAllowed) {
        violations.push({
          type: 'blast_radius_violation',
          error: `OGU3804: File '${relPath}' outside feature's allowed paths`,
        });
      }
    }

    // Check max files
    if (filesTouch.length > (envelope.blastRadius.maxFiles || Infinity)) {
      violations.push({
        type: 'too_many_files',
        error: `OGU3807: Task touches ${filesTouch.length} files, max is ${envelope.blastRadius.maxFiles}`,
      });
    }
  }

  // Failure containment check
  if (envelope.failureContainment.consecutiveFailures >= envelope.failureContainment.maxConsecutiveFailures) {
    violations.push({
      type: 'consecutive_failures',
      error: `OGU3806: Feature '${featureSlug}' hit consecutive failure limit (${envelope.failureContainment.consecutiveFailures}/${envelope.failureContainment.maxConsecutiveFailures})`,
    });
  }

  if (envelope.failureContainment.totalFailures >= envelope.failureContainment.maxTotalFailures) {
    violations.push({
      type: 'total_failures',
      error: `OGU3808: Feature '${featureSlug}' hit total failure limit (${envelope.failureContainment.totalFailures}/${envelope.failureContainment.maxTotalFailures})`,
    });
  }

  return { allowed: violations.length === 0, violations, envelope };
}

/**
 * Record spending against feature envelope.
 */
export function recordSpend(root, featureSlug, amount) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope) return null;

  envelope.budget.spent += amount;
  envelope.budget.remaining = envelope.budget.maxTotalCost - envelope.budget.spent;

  // Check alert thresholds
  const ratio = envelope.budget.spent / envelope.budget.maxTotalCost;
  for (const alert of envelope.budget.alerts) {
    if (ratio >= alert.threshold && !alert.fired) {
      alert.fired = true;
      emitAudit('feature.envelope.alert', {
        slug: featureSlug,
        threshold: alert.threshold,
        action: alert.action,
        ratio,
        spent: envelope.budget.spent,
      }, { feature: { slug: featureSlug } });
    }
  }

  saveEnvelope(root, featureSlug, envelope);
  return { spent: envelope.budget.spent, remaining: envelope.budget.remaining };
}

/**
 * Record a failure against feature envelope.
 */
export function recordFailure(root, featureSlug, { consecutive = true } = {}) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope) return null;

  envelope.failureContainment.totalFailures += 1;
  if (consecutive) {
    envelope.failureContainment.consecutiveFailures += 1;
  } else {
    envelope.failureContainment.consecutiveFailures = 0;
  }

  saveEnvelope(root, featureSlug, envelope);

  return {
    consecutiveFailures: envelope.failureContainment.consecutiveFailures,
    totalFailures: envelope.failureContainment.totalFailures,
    maxConsecutive: envelope.failureContainment.maxConsecutiveFailures,
    maxTotal: envelope.failureContainment.maxTotalFailures,
  };
}

/**
 * Reset consecutive failure count (after a success).
 */
export function resetConsecutiveFailures(root, featureSlug) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope) return;
  envelope.failureContainment.consecutiveFailures = 0;
  saveEnvelope(root, featureSlug, envelope);
}

/**
 * Apply feature-level policy overrides.
 */
export function applyFeatureOverrides(root, featureSlug, policyResult) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope?.policyOverrides?.length) return policyResult;

  const modified = { ...policyResult };

  for (const override of envelope.policyOverrides) {
    if (override.override === 'disabled') {
      modified.matchedRules = (modified.matchedRules || []).filter(r =>
        (typeof r === 'string' ? r : r.id) !== override.ruleId
      );
    }
  }

  return modified;
}

/**
 * Load all feature envelopes.
 */
export function loadAllEnvelopes(root) {
  root = root || repoRoot();
  const featuresDir = join(root, 'docs/vault/04_Features');
  if (!existsSync(featuresDir)) return [];

  const envelopes = [];

  try {
    for (const dir of readdirSync(featuresDir, { withFileTypes: true })) {
      if (dir.isDirectory()) {
        const envelope = loadEnvelope(root, dir.name);
        if (envelope) envelopes.push(envelope);
      }
    }
  } catch { /* ignore */ }

  return envelopes;
}

/**
 * Get envelope status summary for CLI.
 */
export function getEnvelopeStatus(root, featureSlug) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope) return null;

  return {
    slug: featureSlug,
    budget: {
      total: envelope.budget.maxTotalCost,
      spent: envelope.budget.spent,
      remaining: envelope.budget.remaining,
      percent: Math.round((envelope.budget.spent / envelope.budget.maxTotalCost) * 100),
      dailyLimit: envelope.budget.dailyLimit,
      perTaskLimit: envelope.budget.maxCostPerTask,
    },
    concurrency: envelope.concurrency,
    blastRadius: {
      allowedPaths: envelope.blastRadius.allowedPaths,
      blockedPaths: envelope.blastRadius.blockedPaths,
      maxFiles: envelope.blastRadius.maxFiles,
    },
    failures: {
      consecutive: envelope.failureContainment.consecutiveFailures,
      maxConsecutive: envelope.failureContainment.maxConsecutiveFailures,
      total: envelope.failureContainment.totalFailures,
      maxTotal: envelope.failureContainment.maxTotalFailures,
      health: envelope.failureContainment.consecutiveFailures === 0 ? 'healthy' : 'degraded',
    },
    policyOverrides: envelope.policyOverrides.length,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function matchGlob(path, pattern) {
  if (pattern === '**/*' || pattern === '**') return true;
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '$');
    return regex.test(path);
  }
  return path.startsWith(pattern);
}
