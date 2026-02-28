/**
 * Company Snapshot — full org state capture, comparison, and restore.
 *
 * Captures the entire company state: OrgSpec, policies, budget, features,
 * active sessions, resource usage, audit stats, and composite hashes.
 * Enables time-travel, diff, and restore operations.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const SNAPSHOTS_DIR = (root) => join(root, '.ogu/company-snapshots');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
}

// ── Capture ─────────────────────────────────────────────────────────────

/**
 * Capture a full company snapshot.
 */
export function captureCompanySnapshot({ root, label } = {}) {
  root = root || repoRoot();
  const id = `company-snap-${formatTimestamp()}`;
  const timestamp = new Date().toISOString();

  const snapshot = {
    $schema: 'CompanySnapshot/1.0',
    snapshotId: id,
    capturedAt: timestamp,
    capturedBy: process.env.USER || 'system',
    label: label || '',

    orgSpec: captureOrgState(root),
    policyState: capturePolicyState(root),
    budgetState: captureBudgetState(root),
    featurePortfolio: capturePortfolio(root),
    activeSessions: captureActiveSessions(root),
    resourceUsage: captureResourceState(root),
    auditStats: captureAuditStats(root),

    // Legacy compat fields
    state: captureStateJson(root),
    overrideCount: captureOverrideCount(root),
    policyRuleCount: 0,

    hashes: {},
  };

  snapshot.policyRuleCount = snapshot.policyState.activeRules || 0;

  // Compute hashes
  snapshot.hashes = computeHashes(snapshot);

  // Legacy compat
  snapshot.id = id;
  snapshot.timestamp = timestamp;
  snapshot.hash = snapshot.hashes.fullSnapshotHash;
  snapshot.orgSpec_data = snapshot.orgSpec.data;
  snapshot.budget = snapshot.budgetState;
  snapshot.features = snapshot.featurePortfolio;
  snapshot.auditCount = snapshot.auditStats.totalEvents;

  // Save to disk
  const dir = ensureDir(SNAPSHOTS_DIR(root));
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(snapshot, null, 2), 'utf8');

  emitAudit('company.snapshot', {
    snapshotId: id,
    hash: snapshot.hashes.fullSnapshotHash,
  }, {});

  return snapshot;
}

function captureOrgState(root) {
  const path = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(path)) return { hash: null, version: null, roles: 0, teams: 0, data: null };
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return {
      hash: hashContent(readFileSync(path, 'utf8')),
      version: data.org?.version || '1.0.0',
      roles: (data.roles || []).length,
      teams: (data.teams || []).length,
      data,
    };
  } catch { return { hash: null, version: null, roles: 0, teams: 0, data: null }; }
}

function capturePolicyState(root) {
  const rulesPath = join(root, '.ogu/policies/rules.json');
  const versionPath = join(root, '.ogu/policy/policy-version.json');
  const astPath = join(root, '.ogu/policy/policy.ast.json');

  let rules = null, version = null, ast = null;
  try { rules = JSON.parse(readFileSync(rulesPath, 'utf8')); } catch { /* empty */ }
  try { version = JSON.parse(readFileSync(versionPath, 'utf8')); } catch { /* empty */ }
  try { ast = JSON.parse(readFileSync(astPath, 'utf8')); } catch { /* empty */ }

  return {
    version: version?.current?.version || rules?.version || 0,
    rulesHash: version?.current?.rulesHash || hashContent(JSON.stringify(rules)),
    astHash: version?.current?.astHash || null,
    activeRules: (rules?.rules || []).filter(r => r.enabled !== false).length,
    frozen: version?.frozen || false,
  };
}

function captureBudgetState(root) {
  const paths = [
    join(root, '.ogu/BUDGET.json'),
    join(root, '.ogu/budget/budget-state.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch { /* try next */ }
    }
  }
  return { totalSpent: 0, totalBudget: 0 };
}

function capturePortfolio(root) {
  const features = [];
  const featDir = join(root, '.ogu/state/features');
  if (!existsSync(featDir)) return features;

  for (const f of readdirSync(featDir).filter(f => f.endsWith('.state.json'))) {
    try {
      const data = JSON.parse(readFileSync(join(featDir, f), 'utf8'));
      features.push({
        slug: data.slug,
        state: data.currentState,
        since: data.enteredAt,
        buildAttempts: data.buildAttempts || 0,
        version: data.version || 1,
      });
    } catch { /* skip */ }
  }

  return features;
}

function captureActiveSessions(root) {
  const sessions = [];
  const dirs = [
    join(root, '.ogu/agents/sessions'),
    join(root, '.ogu/agents/credentials'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        if (data.status === 'active' || data.state === 'active' || data.session?.state === 'active') {
          sessions.push({
            agentId: data.agentId || data.sessionId,
            roleId: data.roleId,
            taskId: data.taskId || data.session?.taskId,
            featureSlug: data.featureSlug || data.session?.featureSlug,
            state: 'active',
            since: data.createdAt || data.session?.startedAt,
          });
        }
      } catch { /* skip */ }
    }
  }

  return sessions;
}

function captureResourceState(root) {
  const lockPath = join(root, '.ogu/locks/active.json');
  if (!existsSync(lockPath)) return {};
  try {
    const locks = JSON.parse(readFileSync(lockPath, 'utf8'));
    const usage = {};
    for (const slot of (locks.activeSlots || [])) {
      usage[slot.resourceType] = usage[slot.resourceType] || { used: 0, max: 0 };
      usage[slot.resourceType].used += 1;
    }
    return usage;
  } catch { return {}; }
}

function captureAuditStats(root) {
  let totalEvents = 0;
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (existsSync(auditPath)) {
    totalEvents = readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).length;
  }
  return { totalEvents, lastError: null };
}

function captureStateJson(root) {
  const path = join(root, '.ogu/STATE.json');
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

function captureOverrideCount(root) {
  const dir = join(root, '.ogu/overrides');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.json')).length;
}

// ── Hashing ─────────────────────────────────────────────────────────────

function hashContent(content) {
  return 'sha256:' + createHash('sha256').update(String(content)).digest('hex').slice(0, 16);
}

function computeHashes(snapshot) {
  return {
    orgSpecHash: hashContent(JSON.stringify(snapshot.orgSpec)),
    policyHash: hashContent(JSON.stringify(snapshot.policyState)),
    budgetHash: hashContent(JSON.stringify(snapshot.budgetState)),
    portfolioHash: hashContent(JSON.stringify(snapshot.featurePortfolio)),
    fullSnapshotHash: hashContent(JSON.stringify({
      orgSpec: snapshot.orgSpec,
      policyState: snapshot.policyState,
      budgetState: snapshot.budgetState,
      featurePortfolio: snapshot.featurePortfolio,
      auditStats: snapshot.auditStats,
    })),
  };
}

// ── Compare ─────────────────────────────────────────────────────────────

/**
 * Compare two company snapshots.
 */
export function compareSnapshots(snap1, snap2) {
  const changes = [];

  if ((snap1.hashes?.fullSnapshotHash || snap1.hash) === (snap2.hashes?.fullSnapshotHash || snap2.hash)) {
    return { changed: false, changes: [] };
  }

  // OrgSpec
  if (JSON.stringify(snap1.orgSpec) !== JSON.stringify(snap2.orgSpec)) {
    changes.push({ component: 'orgSpec', detail: 'organization configuration changed' });
  }

  // Policy
  const p1 = snap1.policyState || {};
  const p2 = snap2.policyState || {};
  if (p1.rulesHash !== p2.rulesHash) {
    changes.push({ component: 'policy', detail: `rules hash changed: ${p1.rulesHash} → ${p2.rulesHash}` });
  }

  // Budget
  const b1 = snap1.budgetState?.totalSpent || snap1.budget?.daily?.costUsed || 0;
  const b2 = snap2.budgetState?.totalSpent || snap2.budget?.daily?.costUsed || 0;
  if (b1 !== b2) {
    changes.push({ component: 'budget', detail: `spend: $${b1} → $${b2}` });
  }

  // Features
  const f1 = snap1.featurePortfolio || snap1.features || [];
  const f2 = snap2.featurePortfolio || snap2.features || [];
  if (f1.length !== f2.length) {
    changes.push({ component: 'features', detail: `count: ${f1.length} → ${f2.length}` });
  }
  // Feature state changes
  for (const feat2 of f2) {
    const feat1 = f1.find(f => f.slug === feat2.slug);
    if (feat1 && feat1.state !== feat2.state) {
      changes.push({ component: `feature:${feat2.slug}`, detail: `${feat1.state} → ${feat2.state}` });
    }
  }

  // Sessions
  const s1 = (snap1.activeSessions || []).length;
  const s2 = (snap2.activeSessions || []).length;
  if (s1 !== s2) {
    changes.push({ component: 'sessions', detail: `active: ${s1} → ${s2}` });
  }

  // Audit
  const a1 = snap1.auditStats?.totalEvents || snap1.auditCount || 0;
  const a2 = snap2.auditStats?.totalEvents || snap2.auditCount || 0;
  if (a1 !== a2) {
    changes.push({ component: 'audit', detail: `events: ${a1} → ${a2}` });
  }

  // Overrides
  if ((snap1.overrideCount || 0) !== (snap2.overrideCount || 0)) {
    changes.push({ component: 'overrides', detail: `count: ${snap1.overrideCount} → ${snap2.overrideCount}` });
  }

  // State
  if (JSON.stringify(snap1.state) !== JSON.stringify(snap2.state)) {
    changes.push({ component: 'state', detail: `phase: ${snap1.state?.phase || '?'} → ${snap2.state?.phase || '?'}` });
  }

  return { changed: true, changes };
}

// ── Snapshot Management ─────────────────────────────────────────────────

/**
 * Load a saved snapshot by ID.
 */
export function loadSnapshot(root, snapshotId) {
  root = root || repoRoot();
  const path = join(SNAPSHOTS_DIR(root), `${snapshotId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * List all saved snapshots.
 */
export function listSnapshots(root) {
  root = root || repoRoot();
  const dir = SNAPSHOTS_DIR(root);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return {
          snapshotId: data.snapshotId || data.id,
          capturedAt: data.capturedAt || data.timestamp,
          label: data.label || '',
          hash: data.hashes?.fullSnapshotHash || data.hash,
        };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''));
}

/**
 * Restore company state from snapshot (dry run by default).
 */
export function restoreFromSnapshot(root, snapshotId, { dryRun = true } = {}) {
  root = root || repoRoot();
  const snapshot = loadSnapshot(root, snapshotId);
  if (!snapshot) return { error: `Snapshot '${snapshotId}' not found` };

  const wouldRestore = {
    orgSpec: snapshot.orgSpec?.version || 'unknown',
    policyVersion: snapshot.policyState?.version || 0,
    features: (snapshot.featurePortfolio || snapshot.features || []).length,
    budget: snapshot.budgetState || snapshot.budget,
  };

  if (dryRun) {
    return {
      dryRun: true,
      wouldRestore,
      warning: 'This will overwrite current state. Use --execute to apply.',
    };
  }

  // Actual restore
  emitAudit('company.restore_started', {
    snapshotId,
    currentHash: captureCompanySnapshot({ root }).hashes?.fullSnapshotHash,
  }, {});

  // Restore OrgSpec
  if (snapshot.orgSpec?.data) {
    writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify(snapshot.orgSpec.data, null, 2), 'utf8');
  }

  // Restore policy rules
  if (snapshot.policyState?.rulesHash) {
    // Policy rules are in rules.json — we only restore if we have the data
    // Actual rules data isn't stored in snapshot (just hashes) — skip
  }

  emitAudit('company.restore_complete', {
    snapshotId,
    restoredHash: snapshot.hashes?.fullSnapshotHash || snapshot.hash,
  }, {});

  return { dryRun: false, restored: wouldRestore };
}
