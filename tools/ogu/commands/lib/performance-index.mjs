import { existsSync, readFileSync, writeFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Performance Index — per-agent/model/capability metrics with learning signals.
 *
 * Computes metrics from agent state files AND performance history.
 * Detects learning signals for automated routing improvements.
 *
 * Files:
 *   .ogu/performance/index.json     — Aggregated performance metrics
 *   .ogu/performance/history/*.jsonl — Monthly performance log
 */

const INDEX_PATH = '.ogu/performance/index.json';
const HISTORY_DIR = '.ogu/performance/history';

/**
 * Record a task outcome for performance tracking.
 *
 * @param {string} root
 * @param {object} opts
 */
export function recordOutcome(root, {
  roleId, capabilityId, model, featureSlug, taskId,
  success, tokensIn = 0, tokensOut = 0, cost = 0, durationMs = 0,
  retries = 0, escalated = false, errorCode, domain,
}) {
  root = root || repoRoot();
  const entry = {
    timestamp: new Date().toISOString(),
    roleId, capabilityId: capabilityId || 'unknown', model: model || 'unknown',
    featureSlug, taskId, success, tokensIn, tokensOut, cost, durationMs,
    retries, escalated, errorCode: errorCode || null, domain: domain || 'general',
  };

  const month = entry.timestamp.slice(0, 7);
  const histDir = join(root, HISTORY_DIR);
  mkdirSync(histDir, { recursive: true });
  appendFileSync(join(histDir, `${month}.jsonl`), JSON.stringify(entry) + '\n');

  // Incremental index update
  updateIndexIncremental(root, entry);
}

function updateIndexIncremental(root, entry) {
  const index = loadIndex(root);

  // By role
  if (!index.byRole[entry.roleId]) {
    index.byRole[entry.roleId] = { totalTasks: 0, _successes: 0, _escalations: 0, _totalRetries: 0, avgCostPerTask: 0, _totalCost: 0, _totalTokens: 0, byCapability: {}, domainStrength: {} };
  }
  const role = index.byRole[entry.roleId];
  role.totalTasks++;
  if (entry.success) role._successes++;
  if (entry.escalated) role._escalations++;
  role._totalRetries += entry.retries;
  role._totalCost += entry.cost;
  role._totalTokens += entry.tokensIn + entry.tokensOut;
  role.successRate = role._successes / role.totalTasks;
  role.escalationRate = role._escalations / role.totalTasks;
  role.avgCostPerTask = role._totalCost / role.totalTasks;

  // By capability within role
  const capKey = entry.capabilityId;
  if (!role.byCapability[capKey]) {
    role.byCapability[capKey] = { tasks: 0, _successes: 0, _totalTokens: 0, _totalRetries: 0, topFailureCodes: [] };
  }
  const capData = role.byCapability[capKey];
  capData.tasks++;
  if (entry.success) capData._successes++;
  capData._totalTokens += entry.tokensIn + entry.tokensOut;
  capData._totalRetries += entry.retries;
  capData.successRate = capData._successes / capData.tasks;
  capData.avgTokens = Math.round(capData._totalTokens / capData.tasks);
  if (entry.errorCode && !capData.topFailureCodes.includes(entry.errorCode)) {
    capData.topFailureCodes.push(entry.errorCode);
    if (capData.topFailureCodes.length > 5) capData.topFailureCodes.shift();
  }

  // Domain strength
  if (entry.domain) {
    if (!role.domainStrength[entry.domain]) role.domainStrength[entry.domain] = { _tasks: 0, _successes: 0 };
    const ds = role.domainStrength[entry.domain];
    ds._tasks++;
    if (entry.success) ds._successes++;
    role.domainStrength[entry.domain] = { ...ds, score: ds._successes / ds._tasks };
  }

  // By model
  if (!index.byModel[entry.model]) {
    index.byModel[entry.model] = { totalCalls: 0, _successes: 0, _totalCost: 0, _totalTokensIn: 0, _totalTokensOut: 0, _totalDuration: 0, byCapability: {} };
  }
  const model = index.byModel[entry.model];
  model.totalCalls++;
  if (entry.success) model._successes++;
  model._totalCost += entry.cost;
  model._totalTokensIn += entry.tokensIn;
  model._totalTokensOut += entry.tokensOut;
  model._totalDuration += entry.durationMs;
  model.successRate = model._successes / model.totalCalls;
  model.avgCost = model._totalCost / model.totalCalls;
  model.avgLatencyMs = Math.round(model._totalDuration / model.totalCalls);

  if (!model.byCapability[capKey]) model.byCapability[capKey] = { tasks: 0, _successes: 0 };
  const mc = model.byCapability[capKey];
  mc.tasks++;
  if (entry.success) mc._successes++;
  mc.successRate = mc._successes / mc.tasks;

  // By feature
  if (!index.byFeature[entry.featureSlug || '_unset']) {
    index.byFeature[entry.featureSlug || '_unset'] = { totalCost: 0, totalTasks: 0, _successes: 0, escalations: 0 };
  }
  const feat = index.byFeature[entry.featureSlug || '_unset'];
  feat.totalTasks++;
  feat.totalCost += entry.cost;
  if (entry.success) feat._successes++;
  if (entry.escalated) feat.escalations++;
  feat.successRate = feat._successes / feat.totalTasks;

  index.lastUpdated = new Date().toISOString();
  saveIndex(root, index);
}

/**
 * Rebuild the full performance index from history.
 */
export function rebuildIndex(root, { windowDays = 30 } = {}) {
  root = root || repoRoot();
  const cutoff = new Date(Date.now() - windowDays * 86400000);
  const entries = loadHistoryAfter(root, cutoff);

  const index = {
    $schema: 'PerformanceIndex/1.0',
    lastUpdated: new Date().toISOString(),
    window: `${windowDays}d`,
    byRole: {}, byModel: {}, byFeature: {}, learningSignals: [],
  };

  saveIndex(root, index);
  for (const entry of entries) {
    updateIndexIncremental(root, entry);
  }

  // Generate learning signals
  const rebuilt = loadIndex(root);
  rebuilt.learningSignals = detectLearningSignals(rebuilt);
  saveIndex(root, rebuilt);
  return rebuilt;
}

/**
 * Detect learning signals from performance data.
 */
function detectLearningSignals(index) {
  const signals = [];

  // Signal: model-capability mismatch
  for (const [modelId, modelData] of Object.entries(index.byModel)) {
    for (const [capId, capData] of Object.entries(modelData.byCapability || {})) {
      if (capData.successRate < 0.70 && capData.tasks >= 5) {
        signals.push({
          signal: 'model_capability_mismatch',
          description: `${modelId} fails ${capId} ${Math.round((1 - capData.successRate) * 100)}% of the time`,
          evidence: { capability: capId, model: modelId, failRate: 1 - capData.successRate, sample: capData.tasks },
          recommendation: { action: 'update_min_tier', capability: capId, newMinTier: 3 },
          confidence: Math.min(0.95, capData.tasks / 20),
          autoApplicable: false,
        });
      }
    }
  }

  // Signal: role domain weakness
  for (const [roleId, roleData] of Object.entries(index.byRole)) {
    const domains = roleData.domainStrength || {};
    const scores = Object.values(domains).map(d => d.score || 0);
    const avgStrength = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    for (const [domain, data] of Object.entries(domains)) {
      const strength = data.score || 0;
      if (strength < avgStrength * 0.75 && strength < 0.75 && (data._tasks || 0) >= 3) {
        signals.push({
          signal: 'role_domain_weakness',
          description: `${roleId} struggles with ${domain} (${Math.round(strength * 100)}% vs avg ${Math.round(avgStrength * 100)}%)`,
          evidence: { role: roleId, weakDomain: domain, strength },
          recommendation: { action: 'consider_reassignment' },
          confidence: 0.7,
          autoApplicable: false,
        });
      }
    }
  }

  // Signal: high escalation rate
  for (const [roleId, roleData] of Object.entries(index.byRole)) {
    if (roleData.escalationRate > 0.20 && roleData.totalTasks >= 10) {
      signals.push({
        signal: 'high_escalation_rate',
        description: `${roleId} escalates ${Math.round(roleData.escalationRate * 100)}% of tasks`,
        evidence: { role: roleId, escalationRate: roleData.escalationRate },
        recommendation: { action: 'upgrade_default_model' },
        confidence: 0.80,
        autoApplicable: false,
      });
    }
  }

  // Signal: cost efficiency opportunity
  for (const [modelId, modelData] of Object.entries(index.byModel)) {
    if (modelData.successRate >= 0.90 && modelData.avgCost < 0.10 && modelData.totalCalls >= 10) {
      signals.push({
        signal: 'cost_efficiency_opportunity',
        description: `${modelId} handles tasks at ${Math.round(modelData.successRate * 100)}% success — cheaper models work`,
        evidence: { model: modelId, successRate: modelData.successRate },
        recommendation: { action: 'downgrade_default', newDefault: modelId },
        confidence: Math.min(0.95, modelData.totalCalls / 15),
        autoApplicable: true,
      });
    }
  }

  return signals;
}

/**
 * Detect learning signals from performance data (public wrapper).
 * @param {string} root
 * @returns {Array} Learning signals
 */
export function getDetectedSignals(root) {
  root = root || repoRoot();
  const index = loadIndex(root);
  return detectLearningSignals(index);
}

/**
 * Apply a learning signal — adjusts model-config.json routing weights.
 *
 * @param {string} root
 * @param {object} signal - A learning signal from detectLearningSignals()
 * @returns {{ applied: boolean, action: string, detail: string }}
 */
export function applySignal(root, signal) {
  root = root || repoRoot();
  if (!signal || !signal.recommendation?.action) {
    return { applied: false, action: 'none', detail: 'No actionable recommendation' };
  }

  const configPath = join(root, '.ogu/model-config.json');
  let config = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { config = {}; }
  }

  if (!config.routingWeights) config.routingWeights = {};
  if (!config.appliedSignals) config.appliedSignals = [];

  const rec = signal.recommendation;
  const action = rec.action;
  let detail = '';

  switch (action) {
    case 'update_min_tier': {
      if (!config.routingWeights.capabilityMinTier) config.routingWeights.capabilityMinTier = {};
      config.routingWeights.capabilityMinTier[rec.capability] = rec.newMinTier || 3;
      detail = `Set min tier for ${rec.capability} to ${rec.newMinTier || 3}`;
      break;
    }
    case 'downgrade_default': {
      config.routingWeights.defaultModel = rec.newDefault;
      detail = `Changed default model to ${rec.newDefault}`;
      break;
    }
    case 'upgrade_default_model': {
      if (!config.routingWeights.roleUpgrades) config.routingWeights.roleUpgrades = {};
      const role = signal.evidence?.role;
      if (role) {
        config.routingWeights.roleUpgrades[role] = true;
        detail = `Flagged ${role} for model upgrade`;
      } else {
        detail = 'No role specified';
      }
      break;
    }
    case 'consider_reassignment': {
      detail = `Signal noted: ${signal.description}`;
      break;
    }
    default:
      return { applied: false, action, detail: `Unknown action: ${action}` };
  }

  config.appliedSignals.push({
    signal: signal.signal,
    action,
    appliedAt: new Date().toISOString(),
    confidence: signal.confidence,
  });

  const dir = join(root, '.ogu');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  return { applied: true, action, detail };
}

/**
 * Compute metrics from agent state files (legacy).
 */
export function computeAgentMetrics({ root } = {}) {
  root = root || repoRoot();
  const agentDir = join(root, '.ogu/agents');
  if (!existsSync(agentDir)) return [];

  const metrics = [];
  for (const f of readdirSync(agentDir).filter(f => f.endsWith('.state.json'))) {
    try {
      const state = JSON.parse(readFileSync(join(agentDir, f), 'utf8'));
      const completed = state.tasksCompleted || 0;
      const failed = state.tasksFailed || 0;
      const total = completed + failed;
      metrics.push({
        roleId: state.roleId,
        tasksCompleted: completed,
        tasksFailed: failed,
        totalTasks: total,
        successRate: total > 0 ? completed / total : 0,
        costPerTask: total > 0 ? (state.costUsed || 0) / total : 0,
        tokensPerTask: total > 0 ? Math.round((state.tokensUsed || 0) / total) : 0,
        totalCost: state.costUsed || 0,
        totalTokens: state.tokensUsed || 0,
        lastActiveAt: state.lastActiveAt,
      });
    } catch { /* skip */ }
  }
  return metrics;
}

/**
 * Compute org-wide performance aggregates.
 */
export function computeOrgPerformance({ root } = {}) {
  const metrics = computeAgentMetrics({ root });
  const totalCompleted = metrics.reduce((s, m) => s + m.tasksCompleted, 0);
  const totalFailed = metrics.reduce((s, m) => s + m.tasksFailed, 0);
  const totalTasks = totalCompleted + totalFailed;
  return {
    totalTasks, totalCompleted, totalFailed,
    overallSuccessRate: totalTasks > 0 ? totalCompleted / totalTasks : 0,
    totalCost: metrics.reduce((s, m) => s + m.totalCost, 0),
    totalTokens: metrics.reduce((s, m) => s + m.totalTokens, 0),
    agentCount: metrics.length,
  };
}

/**
 * Load the performance index.
 */
export function loadIndex(root) {
  root = root || repoRoot();
  const indexPath = join(root, INDEX_PATH);
  if (existsSync(indexPath)) {
    try { return JSON.parse(readFileSync(indexPath, 'utf8')); } catch { /* fall through */ }
  }
  return { $schema: 'PerformanceIndex/1.0', lastUpdated: null, window: '30d', byRole: {}, byModel: {}, byFeature: {}, learningSignals: [] };
}

function saveIndex(root, index) {
  const dir = join(root, '.ogu/performance');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, INDEX_PATH), JSON.stringify(index, null, 2));
}

function loadHistoryAfter(root, cutoff) {
  const histDir = join(root, HISTORY_DIR);
  if (!existsSync(histDir)) return [];
  const entries = [];
  for (const f of readdirSync(histDir).filter(f => f.endsWith('.jsonl'))) {
    try {
      const lines = readFileSync(join(histDir, f), 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const entry = JSON.parse(line);
        if (new Date(entry.timestamp) >= cutoff) entries.push(entry);
      }
    } catch { /* skip */ }
  }
  return entries;
}
