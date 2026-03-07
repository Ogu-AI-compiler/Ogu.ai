import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { loadOrgSpec, loadAgentState, riskTierLevel } from './agent-registry.mjs';
import { loadRoutingConfig, ROUTING_STRATEGIES } from './model-routing-config.mjs';
import { createModelRouteLogger } from './model-route-logger.mjs';

// Shared route logger for the current process lifetime
const _routeLogger = createModelRouteLogger();

/**
 * Model Router — selects the optimal model for a task.
 *
 * Two modes:
 * 1. routeSelect()  — capability-based selection (legacy, simple)
 * 2. routeModel()   — role-based selection with escalation (plan-specified)
 */

const CONFIG_PATH = '.ogu/model-config.json';
const LOG_PATH = '.ogu/model-log.jsonl';
const TIER_ORDER = ['fast', 'standard', 'advanced', 'premium'];

// ── routeModel (plan-specified, role-based) ──

/**
 * Route a model selection decision based on role, budget, and escalation.
 *
 * @param {Object} input
 * @param {string} input.roleId - Agent role requesting the model
 * @param {string} input.phase - Current pipeline phase
 * @param {string} input.taskId - Task identifier (for logging)
 * @param {number} input.failureCount - How many times this task has failed
 * @param {string} [input.requestedModel] - Explicit model request (override)
 * @param {string} [input.riskTier] - Override risk tier
 * @returns {{ provider: string, model: string, fullModelId: string, reason: string, retryPolicy: Object }}
 */
export function routeModel(input) {
  const root = repoRoot();
  const config = loadModelConfig(root);
  const orgSpec = loadOrgSpec(root);
  const agentState = loadAgentState(input.roleId, root);

  // Load routing config for strategy-based overrides
  const routingConfig = loadRoutingConfig({ root });
  const strategyName = routingConfig.strategy || 'balanced';
  const strategy = ROUTING_STRATEGIES[strategyName] || ROUTING_STRATEGIES.balanced;

  // Step 1: If explicit model requested, validate and use
  if (input.requestedModel) {
    const resolved = resolveExplicitModel(config, input.requestedModel);
    if (resolved) {
      logDecision(root, { ...input, ...resolved, reason: 'explicit-request' });
      return { ...resolved, reason: 'explicit-request', retryPolicy: defaultRetryPolicy(config) };
    }
  }

  // Step 2: Get role's model policy
  const role = orgSpec?.roles?.find(r => r.roleId === input.roleId);
  const policy = role?.modelPolicy || orgSpec?.defaults?.modelPolicy || { default: 'sonnet', maxTier: 'opus', escalationEnabled: true, escalationChain: ['haiku', 'sonnet', 'opus'] };
  const routingPolicy = config.routingPolicies[config.activePolicy] || config.routingPolicies.balanced;

  // Step 3: Determine target tier
  let targetTier = tierForModel(config, policy.default) || 2;

  // Step 4: Check if escalation needed (strategy.escalateOnFailure can override policy)
  let reason = 'role-default';
  let escalatedFrom = null;
  const escalationAllowed = strategy.escalateOnFailure !== false && policy.escalationEnabled !== false;
  if (input.failureCount > 0 && escalationAllowed) {
    const chain = policy.escalationChain || orgSpec?.defaults?.modelPolicy?.escalationChain || ['haiku', 'sonnet', 'opus'];
    const escalationIndex = Math.min(input.failureCount, chain.length - 1);
    const escalatedModel = chain[escalationIndex];
    const newTier = tierForModel(config, escalatedModel);
    if (newTier > targetTier) {
      escalatedFrom = policy.default;
      targetTier = newTier;
      reason = 'escalation';
    }
  }

  // Step 5: Check budget constraints
  const budget = role?.budgetQuota || orgSpec?.defaults?.budgetQuota || { dailyTokens: 1000000 };
  const tokensUsed = agentState.tokensUsedToday || agentState.tokensUsed || 0;
  if (tokensUsed >= budget.dailyTokens) {
    targetTier = 1; // Budget exhausted — downgrade to cheapest
    reason = 'budget-exhausted';
  }

  // Step 6: Cap at maxTier
  const maxTier = tierForModel(config, policy.maxTier || 'opus');
  targetTier = Math.min(targetTier, maxTier);

  // Step 7: Find best available model at target tier
  const selected = findModelAtTier(config, targetTier);

  const result = {
    provider: selected.providerId,
    model: selected.model.id,
    fullModelId: selected.model.fullId,
    reason,
    retryPolicy: {
      maxRetries: routingPolicy.maxEscalations,
      escalateOnFailure: routingPolicy.escalateOnFailure,
      backoffMs: 1000,
    },
  };

  logDecision(root, {
    ...input,
    selectedModel: result.model,
    selectedProvider: result.provider,
    reason,
    budgetRemaining: budget.dailyTokens - tokensUsed,
    escalatedFrom,
  });

  // Log to in-memory route logger for runtime stats
  _routeLogger.log({
    role: input.roleId,
    requestedModel: input.requestedModel || null,
    selectedModel: result.model,
    reason,
  });

  return result;
}

/**
 * Get routing statistics from log.
 */
export function routingStats(root, { days = 7 } = {}) {
  root = root || repoRoot();
  const logPath = join(root, LOG_PATH);
  if (!existsSync(logPath)) return { decisions: 0, byModel: {}, escalations: 0, totalCost: 0 };

  const cutoff = Date.now() - days * 86400000;
  const lines = readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (new Date(entry.timestamp).getTime() >= cutoff) entries.push(entry);
    } catch { /* skip malformed */ }
  }

  const byModel = {};
  let escalations = 0;
  for (const e of entries) {
    const m = e.selectedModel || 'unknown';
    byModel[m] = (byModel[m] || 0) + 1;
    if (e.reason === 'escalation') escalations++;
  }

  return { decisions: entries.length, byModel, escalations, totalCost: 0 };
}

// ── routeSelect (legacy, capability-based) ──

/**
 * @param {object} options
 * @param {string} options.root - Repo root
 * @param {string} options.capability - Required capability
 * @param {string} [options.tier] - Exact tier to use
 * @param {string} [options.minTier] - Minimum tier
 * @param {boolean} [options.budgetAware] - Factor in remaining budget
 */
export function routeSelect({ root, capability, tier, minTier, budgetAware }) {
  const orgSpecPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgSpecPath)) {
    throw new Error('OGU2001: OrgSpec.json not found. Run ogu org:init first.');
  }

  const orgSpec = JSON.parse(readFileSync(orgSpecPath, 'utf8'));
  const providers = orgSpec.providers || [];

  const allModels = [];
  for (const provider of providers) {
    for (const model of (provider.models || [])) {
      allModels.push({
        provider: provider.id,
        model: model.id,
        tier: model.tier,
        capabilities: model.capabilities || [],
        costPer1kInput: model.costPer1kInput || 0,
        costPer1kOutput: model.costPer1kOutput || 0,
      });
    }
  }

  let candidates = allModels.filter(m => m.capabilities.includes(capability));
  if (candidates.length === 0) throw new Error(`OGU2010: No model has capability "${capability}"`);

  if (tier) {
    candidates = candidates.filter(m => m.tier === tier);
    if (candidates.length === 0) throw new Error(`OGU2011: No model at tier "${tier}" has capability "${capability}"`);
  }

  if (minTier) {
    const minIdx = TIER_ORDER.indexOf(minTier);
    if (minIdx >= 0) candidates = candidates.filter(m => TIER_ORDER.indexOf(m.tier) >= minIdx);
    if (candidates.length === 0) throw new Error(`OGU2012: No model at tier "${minTier}" or above has capability "${capability}"`);
  }

  candidates.sort((a, b) => a.costPer1kInput - b.costPer1kInput);

  let budgetConstrained = false;
  if (budgetAware) {
    const budgetInfo = loadBudgetRemaining(root, orgSpec);
    if (budgetInfo.remaining < budgetInfo.limit * 0.2) budgetConstrained = true;
  }

  const selected = candidates[0];
  return {
    provider: selected.provider,
    model: selected.model,
    tier: selected.tier,
    costPer1kInput: selected.costPer1kInput,
    costPer1kOutput: selected.costPer1kOutput,
    budgetConstrained,
    reason: budgetConstrained
      ? `Budget-constrained: picked cheapest model with "${capability}"`
      : `Cheapest model with "${capability}" at ${tier || minTier || 'any'} tier`,
  };
}

/**
 * Get runtime routing stats from the in-memory route logger.
 */
export function getRuntimeRoutingStats() {
  return _routeLogger.getStats();
}

export function getNextTier(currentTier) {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

// ── Internal helpers ──

function loadModelConfig(root) {
  const configPath = join(root, CONFIG_PATH);
  if (!existsSync(configPath)) {
    // Return sensible defaults
    return {
      providers: [{ id: 'anthropic', enabled: true, models: [
        { id: 'haiku', fullId: 'claude-haiku-4-5-20251001', tier: 1, costPer1kInput: 0.001, costPer1kOutput: 0.005, maxTokens: 200000 },
        { id: 'sonnet', fullId: 'claude-sonnet-4-6', tier: 2, costPer1kInput: 0.003, costPer1kOutput: 0.015, maxTokens: 200000 },
        { id: 'opus', fullId: 'claude-opus-4-6', tier: 3, costPer1kInput: 0.015, costPer1kOutput: 0.075, maxTokens: 200000 },
      ] }],
      routingPolicies: { balanced: { preferTier: null, escalateOnFailure: true, maxEscalations: 2 } },
      activePolicy: 'balanced',
    };
  }
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function tierForModel(config, modelId) {
  for (const provider of config.providers) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) return model.tier;
  }
  return 2; // default to mid-tier
}

function findModelAtTier(config, tier) {
  for (const provider of config.providers.filter(p => p.enabled)) {
    const candidates = provider.models
      .filter(m => m.tier <= tier)
      .sort((a, b) => b.tier - a.tier);
    if (candidates.length > 0) {
      return { providerId: provider.id, model: candidates[0] };
    }
  }
  // Fallback to any available model
  for (const provider of config.providers.filter(p => p.enabled)) {
    if (provider.models.length > 0) {
      return { providerId: provider.id, model: provider.models[0] };
    }
  }
  throw new Error('OGU2102: No available model');
}

function resolveExplicitModel(config, modelId) {
  for (const provider of config.providers.filter(p => p.enabled)) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) {
      return { provider: provider.id, model: model.id, fullModelId: model.fullId };
    }
  }
  return null;
}

function logDecision(root, data) {
  const dir = join(root, '.ogu');
  mkdirSync(dir, { recursive: true });
  const entry = { timestamp: new Date().toISOString(), ...data };
  try {
    appendFileSync(join(root, LOG_PATH), JSON.stringify(entry) + '\n');
  } catch { /* logging is best-effort */ }
}

function defaultRetryPolicy(config) {
  const policy = config.routingPolicies[config.activePolicy] || {};
  return { maxRetries: policy.maxEscalations || 2, escalateOnFailure: policy.escalateOnFailure !== false, backoffMs: 1000 };
}

function loadBudgetRemaining(root, orgSpec) {
  const limit = orgSpec.budget?.dailyLimit || 50;
  const budgetPath = join(root, '.ogu/budget/budget-state.json');
  if (!existsSync(budgetPath)) return { remaining: limit, limit };
  const state = JSON.parse(readFileSync(budgetPath, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const todaySpent = state.daily?.[today]?.spent || 0;
  return { remaining: limit - todaySpent, limit };
}
