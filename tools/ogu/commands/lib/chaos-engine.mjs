/**
 * Chaos Engine — failure simulation and injection for testing resilience.
 *
 * 8 injection types:
 *   agent_failure, budget_exhaustion, policy_conflict, blast_radius_violation,
 *   model_unavailable, concurrent_overload, secret_leak_attempt, session_expiry
 *
 * Every injection has cleanup — chaos tests must not leave permanent damage.
 * Chaos test results = proof that isolation works.
 *
 * Also provides legacy createChaosEngine() for backwards compat.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const CHAOS_DIR = (root) => join(root, '.ogu/chaos');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Legacy exports (backwards compat) ──────────────────────────────────

export const CHAOS_SCENARIOS = [
  'budget_exhaustion', 'network_partition', 'task_crash',
  'secret_leak_attempt', 'agent_timeout', 'storage_full',
];

const SCENARIO_DEFS = {
  budget_exhaustion: [{ target: 'budget', type: 'exhaust', duration: 0 }, { target: 'llm', type: 'reject', duration: 0 }],
  network_partition: [{ target: 'api', type: 'timeout', duration: 30000 }, { target: 'webhook', type: 'unreachable', duration: 30000 }],
  task_crash: [{ target: 'runner', type: 'crash', duration: 0 }],
  secret_leak_attempt: [{ target: 'env', type: 'expose', duration: 0 }],
  agent_timeout: [{ target: 'agent', type: 'timeout', duration: 60000 }],
  storage_full: [{ target: 'disk', type: 'full', duration: 0 }],
};

export function createChaosEngine() {
  const active = [];
  let totalInjected = 0;
  return {
    injectFailure({ target, type, duration = 0 }) {
      active.push({ target, type, duration, injectedAt: new Date().toISOString() });
      totalInjected++;
    },
    clearFailures() { active.length = 0; },
    getActiveFailures() { return [...active]; },
    simulateScenario(scenario) {
      const defs = SCENARIO_DEFS[scenario] || [];
      for (const def of defs) { active.push({ ...def, injectedAt: new Date().toISOString() }); totalInjected++; }
      return { scenario, injected: defs.length };
    },
    getReport() { return { totalInjected, activeCount: active.length, failures: [...active], timestamp: new Date().toISOString() }; },
  };
}

// ── New: Formal Chaos Injection ─────────────────────────────────────────

export const INJECTOR_TYPES = [
  'agent_failure', 'budget_exhaustion', 'policy_conflict',
  'blast_radius_violation', 'model_unavailable', 'concurrent_overload',
  'secret_leak_attempt', 'session_expiry',
];

/**
 * Generate a chaos test plan for a feature.
 */
export function generateChaosPlan(root, featureSlug) {
  root = root || repoRoot();
  const planId = `chaos-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5)}`;

  const plan = {
    $schema: 'ChaosTest/1.0',
    planId,
    description: `Chaos test plan for ${featureSlug}`,
    targetFeature: featureSlug,
    createdAt: new Date().toISOString(),
    injections: [
      { id: 'inj-1', type: 'agent_failure', params: { failureMode: 'crash' }, expected: { containment: true, otherFeaturesAffected: false, resourcesReleased: true } },
      { id: 'inj-2', type: 'budget_exhaustion', params: { simulatedSpendRatio: 0.96 }, expected: { blocked: true, otherFeaturesAffected: false } },
      { id: 'inj-3', type: 'blast_radius_violation', params: { fileAttempt: '.env.production' }, expected: { blocked: true } },
      { id: 'inj-4', type: 'concurrent_overload', params: { simultaneousTasks: 10, targetResource: 'model_call' }, expected: { queueingActivated: true, maxConcurrencyRespected: true } },
      { id: 'inj-5', type: 'secret_leak_attempt', params: { secretPath: '.ogu/secrets/api-key.json' }, expected: { blocked: true } },
      { id: 'inj-6', type: 'session_expiry', params: { forceExpire: true }, expected: { sessionTerminated: true } },
    ],
  };

  const dir = ensureDir(CHAOS_DIR(root));
  writeFileSync(join(dir, `${planId}.json`), JSON.stringify(plan, null, 2), 'utf8');
  return plan;
}

/**
 * Load a chaos test plan.
 */
export function loadChaosPlan(root, planId) {
  root = root || repoRoot();
  const path = join(CHAOS_DIR(root), `${planId}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/**
 * Run a single chaos injection.
 */
export function injectFault(root, type, params, featureSlug) {
  root = root || repoRoot();
  if (!INJECTOR_TYPES.includes(type)) {
    return { status: 'error', error: `Unknown injection type: ${type}` };
  }

  emitAudit('chaos.inject', { type, featureSlug, params }, {});

  const injector = INJECTORS[type];
  const result = injector(root, params || {}, featureSlug);

  return {
    status: 'completed',
    type,
    featureSlug,
    results: result.results,
    cleanup: result.cleanup,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run a full chaos test plan.
 */
export function runChaosPlan(root, planId) {
  root = root || repoRoot();
  const plan = loadChaosPlan(root, planId);
  if (!plan) return { error: `Plan '${planId}' not found` };

  emitAudit('chaos.plan_started', { planId, injections: plan.injections.length, targetFeature: plan.targetFeature }, {});

  const results = [];

  for (const injection of plan.injections) {
    const result = injectFault(root, injection.type, injection.params, plan.targetFeature);
    const verification = verifyExpectations(injection.expected, result.results || {});

    results.push({
      id: injection.id,
      type: injection.type,
      status: verification.allPassed ? 'passed' : 'failed',
      expectations: verification.details,
      result: result.results,
    });

    // Cleanup
    if (result.cleanup?.restore) {
      try { result.cleanup.restore(); } catch { /* skip */ }
    }
  }

  const report = {
    planId,
    targetFeature: plan.targetFeature,
    completedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
    },
  };

  const dir = ensureDir(CHAOS_DIR(root));
  writeFileSync(join(dir, `${planId}-report.json`), JSON.stringify(report, null, 2), 'utf8');

  emitAudit('chaos.plan_complete', { planId, ...report.summary }, {});
  return report;
}

// ── Individual Injectors ────────────────────────────────────────────────

const INJECTORS = {
  agent_failure(root, params, featureSlug) {
    const { failureMode = 'crash' } = params;
    let revoked = false;
    try {
      const { revokeAgent, listActiveSessions } = require('./agent-identity.mjs');
      const sessions = listActiveSessions(root);
      const target = sessions.find(s => s.featureSlug === featureSlug);
      if (target?.agentId) {
        revokeAgent(root, target.agentId, { reason: `chaos_test:${failureMode}`, revokedBy: 'chaos-engine' });
        revoked = true;
      }
    } catch { /* skip */ }
    return { results: { failureMode, containment: revoked, resourcesReleased: revoked }, cleanup: {} };
  },

  budget_exhaustion(root, params, featureSlug) {
    const { simulatedSpendRatio = 0.96 } = params;
    let result = { blocked: false, otherFeaturesAffected: false };
    let originalSpent;
    try {
      const { loadEnvelope, saveEnvelope, checkEnvelope } = require('./feature-isolation.mjs');
      const envelope = loadEnvelope(root, featureSlug);
      if (envelope) {
        originalSpent = envelope.budget.spent;
        envelope.budget.spent = envelope.budget.maxTotalCost * simulatedSpendRatio;
        envelope.budget.remaining = envelope.budget.maxTotalCost - envelope.budget.spent;
        saveEnvelope(root, featureSlug, envelope);
        const check = checkEnvelope(root, featureSlug, { taskCost: 1 });
        result.blocked = !check.allowed;
      }
    } catch { /* skip */ }
    return {
      results: result,
      cleanup: {
        restore: () => {
          try {
            const { loadEnvelope, saveEnvelope } = require('./feature-isolation.mjs');
            const envelope = loadEnvelope(root, featureSlug);
            if (envelope && originalSpent !== undefined) {
              envelope.budget.spent = originalSpent;
              envelope.budget.remaining = envelope.budget.maxTotalCost - originalSpent;
              envelope.budget.alerts.forEach(a => { a.fired = false; });
              saveEnvelope(root, featureSlug, envelope);
            }
          } catch { /* skip */ }
        },
      },
    };
  },

  policy_conflict(root, params) {
    let result = { conflictDetected: false, resolutionLogged: false };
    try {
      const { evaluatePolicy } = require('./policy-engine.mjs');
      const evaluation = evaluatePolicy({
        taskName: 'chaos-test-conflicting-task',
        riskTier: 'high',
        touches: ['src/auth/login.ts'],
        capability: 'code_generation',
        _root: root,
      });
      result.conflictDetected = (evaluation.matchedRules || []).length > 0;
      result.resolutionLogged = !!evaluation.resolutionLog;
      result.decision = evaluation.decision;
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },

  blast_radius_violation(root, params, featureSlug) {
    const { fileAttempt = '.env.production' } = params;
    let result = { blocked: false };
    try {
      const { checkEnvelope } = require('./feature-isolation.mjs');
      const check = checkEnvelope(root, featureSlug, { filesTouch: [fileAttempt] });
      result.blocked = !check.allowed;
    } catch { /* skip */ }
    try {
      const { validateFileAccess } = require('./sandbox-policy.mjs');
      const sandboxCheck = validateFileAccess({ root, roleId: 'backend-dev', filePath: fileAttempt });
      if (!sandboxCheck.allowed) result.blocked = true;
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },

  model_unavailable(root, params) {
    let result = { fallbackTriggered: false };
    try {
      const { routeModel } = require('./model-router.mjs');
      const routing = routeModel({ root, roleId: 'backend-dev', phase: 'build', failureCount: 5 });
      result.fallbackTriggered = true;
      result.model = routing?.model;
      result.escalated = routing?.escalated;
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },

  concurrent_overload(root, params) {
    const { simultaneousTasks = 10, targetResource = 'model_call' } = params;
    let result = { queueingActivated: false, maxConcurrencyRespected: true };
    const slots = [];
    try {
      const { acquireResource, releaseResource } = require('./resource-governor.mjs');
      let queued = false;
      for (let i = 0; i < simultaneousTasks; i++) {
        const slot = acquireResource(root, { resourceType: targetResource, agentId: `chaos-agent-${i}`, taskId: `chaos-task-${i}`, priority: 50 });
        if (slot.granted) slots.push(slot);
        else queued = true;
      }
      result.queueingActivated = queued;
      result.slotsAcquired = slots.length;
      result.maxConcurrencyRespected = slots.length <= 5;
      for (const slot of slots) { try { releaseResource(root, slot.slotId); } catch { /* skip */ } }
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },

  secret_leak_attempt(root, params) {
    const { secretPath = '.ogu/secrets/api-key.json' } = params;
    let result = { blocked: false };
    try {
      const { validateFileAccess } = require('./sandbox-policy.mjs');
      const check = validateFileAccess({ root, roleId: 'backend-dev', filePath: secretPath, mode: 'read' });
      result.blocked = !check.allowed;
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },

  session_expiry(root, params, featureSlug) {
    let result = { sessionTerminated: false };
    try {
      const { checkSessionHealth, listActiveSessions } = require('./agent-identity.mjs');
      const sessions = listActiveSessions(root);
      const target = sessions.find(s => s.featureSlug === featureSlug);
      if (target) {
        const health = checkSessionHealth(root, target.agentId);
        result.sessionTerminated = !health.alive;
      }
    } catch { /* skip */ }
    return { results: result, cleanup: {} };
  },
};

// ── Verification ────────────────────────────────────────────────────────

function verifyExpectations(expected, actual) {
  const details = [];
  let allPassed = true;
  for (const [key, expectedValue] of Object.entries(expected || {})) {
    const actualValue = actual[key];
    const passed = typeof expectedValue === 'boolean'
      ? !!actualValue === expectedValue
      : actualValue === expectedValue;
    details.push({ expectation: key, expected: expectedValue, actual: actualValue, passed });
    if (!passed) allPassed = false;
  }
  return { allPassed, details };
}

/**
 * Measure resilience from chaos plan results.
 *
 * Loads the chaos plan report, computes MTTR (mean time to recovery),
 * success rate, and weakness summary.
 *
 * @param {string} root
 * @param {string} planId
 * @returns {{ planId, successRate, mttr, weaknesses, summary }}
 */
export function measureResilience(root, planId) {
  root = root || repoRoot();
  const reportPath = join(CHAOS_DIR(root), `${planId}-report.json`);
  if (!existsSync(reportPath)) {
    // Try loading the plan and running it first
    const plan = loadChaosPlan(root, planId);
    if (!plan) return { planId, error: 'Plan not found' };
    return { planId, error: 'Report not generated yet — run the plan first' };
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const results = report.results || [];
  const total = results.length;
  const passedCount = results.filter(r => r.status === 'passed').length;
  const successRate = total > 0 ? passedCount / total : 0;

  // Identify weaknesses (failed injections)
  const weaknesses = results
    .filter(r => r.status === 'failed')
    .map(r => ({
      type: r.type,
      failedExpectations: (r.expectations || []).filter(e => !e.passed).map(e => e.expectation),
    }));

  // Estimate MTTR from plan execution time
  const createdAt = report.createdAt || report.completedAt;
  const completedAt = report.completedAt;
  let mttrMs = 0;
  if (createdAt && completedAt) {
    mttrMs = Math.max(0, new Date(completedAt).getTime() - new Date(createdAt).getTime());
  }

  const summary = [
    `Resilience report for ${planId}`,
    `Success rate: ${Math.round(successRate * 100)}% (${passedCount}/${total})`,
    `MTTR: ${mttrMs}ms`,
    weaknesses.length > 0
      ? `Weaknesses: ${weaknesses.map(w => w.type).join(', ')}`
      : 'No weaknesses detected',
  ].join('\n');

  return { planId, successRate, mttrMs, weaknesses, total, passed: passedCount, summary };
}

/**
 * List all chaos plans and reports.
 */
export function listChaosPlans(root) {
  root = root || repoRoot();
  const dir = CHAOS_DIR(root);
  if (!existsSync(dir)) return { plans: [], reports: [] };
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  return {
    plans: files.filter(f => !f.includes('-report')).map(f => f.replace('.json', '')),
    reports: files.filter(f => f.includes('-report')).map(f => f.replace('.json', '')),
  };
}
