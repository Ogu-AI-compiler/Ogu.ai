import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { calculateCost as calcModelCost, estimateTaskCost } from './cost-calculator.mjs';
import { createBudgetRoleTracker } from './budget-role-tracker.mjs';
import { getAgentsDir, getBudgetDir, resolveOguPath } from './runtime-paths.mjs';

// Shared per-role budget tracker for the current process lifetime
const _roleTracker = createBudgetRoleTracker();

/**
 * Budget tracker — tracks token spending per feature/agent/model.
 * State: .ogu/budget/budget-state.json
 * Transactions: .ogu/budget/transactions.jsonl
 */

const BUDGET_DIR = () => getBudgetDir(repoRoot());
const STATE_FILE = () => join(BUDGET_DIR(), 'budget-state.json');
const TX_FILE = () => join(BUDGET_DIR(), 'transactions.jsonl');

/**
 * Initialize or load budget state.
 * Creates default state if it doesn't exist.
 *
 * @param {object} [budgetConfig] - Budget config from OrgSpec
 * @returns {object} Budget state
 */
export function loadBudget(budgetConfig) {
  const dir = BUDGET_DIR();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Load OrgSpec for limits
  const root = repoRoot();
  const orgSpecPath = resolveOguPath(root, 'OrgSpec.json');
  let orgBudget = budgetConfig;
  if (!orgBudget && existsSync(orgSpecPath)) {
    const orgSpec = JSON.parse(readFileSync(orgSpecPath, 'utf8'));
    orgBudget = orgSpec.budget;
  }
  const dailyLimit = orgBudget?.dailyLimit || 50;
  const monthlyLimit = orgBudget?.monthlyLimit || 1000;

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  if (existsSync(STATE_FILE())) {
    const raw = JSON.parse(readFileSync(STATE_FILE(), 'utf8'));

    // Handle date-keyed format (from budget-cmd / tests)
    if (raw.daily && !raw.daily.date && typeof raw.daily === 'object') {
      const dayData = raw.daily[today] || { spent: 0 };
      const monthData = raw.monthly?.[month] || { spent: 0 };
      // Normalize model entries to canonical schema format
      const rawModels = raw.byModel || raw.models || {};
      const models = {};
      for (const [key, val] of Object.entries(rawModels)) {
        models[key] = {
          tokensUsed: val.tokensUsed ?? 0,
          costUsed: val.costUsed ?? val.spent ?? 0,
          callCount: val.callCount ?? val.calls ?? 0,
        };
      }

      return {
        version: raw.version || 1,
        updatedAt: raw.updatedAt || new Date().toISOString(),
        daily: { date: today, tokensUsed: 0, costUsed: dayData.spent || 0, limit: dailyLimit },
        monthly: { month, tokensUsed: 0, costUsed: monthData.spent || 0, limit: monthlyLimit },
        features: raw.byFeature || raw.features || {},
        models,
      };
    }

    // Ensure limits are set (may have been created without OrgSpec)
    if (!raw.daily.limit) raw.daily.limit = dailyLimit;
    if (!raw.monthly.limit) raw.monthly.limit = monthlyLimit;
    return raw;
  }

  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    daily: { date: today, tokensUsed: 0, costUsed: 0, limit: dailyLimit },
    monthly: { month, tokensUsed: 0, costUsed: 0, limit: monthlyLimit },
    features: {},
    models: {},
  };

  writeBudget(state);
  return state;
}

/**
 * Record a token deduction.
 *
 * @param {object} params
 * @param {string} params.featureSlug
 * @param {string} [params.taskId]
 * @param {string} params.agentRoleId
 * @param {string} params.model
 * @param {string} params.provider
 * @param {number} params.inputTokens
 * @param {number} params.outputTokens
 * @param {number} params.cost
 * @returns {object} Updated budget state
 */
export function deductBudget(params) {
  const state = loadBudget();
  const total = params.inputTokens + params.outputTokens;

  // Use cost-calculator for precise cost computation when model is known
  let computedCost = params.cost;
  if (!computedCost && params.model) {
    try {
      computedCost = calcModelCost({
        model: params.model,
        tokensIn: params.inputTokens,
        tokensOut: params.outputTokens,
      });
    } catch {
      // Model not in pricing table — fall back to provided cost or 0
      computedCost = params.cost || 0;
    }
  }
  params.cost = computedCost || params.cost || 0;

  // Record per-role spending via budget-role-tracker
  if (params.agentRoleId && params.agentRoleId !== 'manual') {
    _roleTracker.record(params.agentRoleId, {
      tokensIn: params.inputTokens,
      tokensOut: params.outputTokens,
      cost: params.cost,
    });
  }

  // Reset daily counters if date changed
  const today = new Date().toISOString().split('T')[0];
  if (state.daily.date !== today) {
    state.daily.date = today;
    state.daily.tokensUsed = 0;
    state.daily.costUsed = 0;
  }

  // Reset monthly counters if month changed
  const month = today.slice(0, 7);
  if (state.monthly.month !== month) {
    state.monthly.month = month;
    state.monthly.tokensUsed = 0;
    state.monthly.costUsed = 0;
  }

  // Update daily
  state.daily.tokensUsed += total;
  state.daily.costUsed += params.cost;

  // Update monthly
  state.monthly.tokensUsed += total;
  state.monthly.costUsed += params.cost;

  // Update per-feature
  if (!state.features[params.featureSlug]) {
    state.features[params.featureSlug] = { tokensUsed: 0, costUsed: 0 };
  }
  state.features[params.featureSlug].tokensUsed += total;
  state.features[params.featureSlug].costUsed += params.cost;

  // Update per-model
  const modelKey = `${params.provider}/${params.model}`;
  if (!state.models[modelKey]) {
    state.models[modelKey] = { tokensUsed: 0, costUsed: 0, callCount: 0 };
  }
  state.models[modelKey].tokensUsed += total;
  state.models[modelKey].costUsed += params.cost;
  state.models[modelKey].callCount += 1;

  // Update per-role (agent state)
  if (params.agentRoleId && params.agentRoleId !== 'manual') {
    try {
      updateAgentBudget(params.agentRoleId, total, params.cost);
    } catch { /* agent state update is best-effort */ }
  }

  state.updatedAt = new Date().toISOString();
  writeBudget(state);

  // Append transaction
  const tx = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'deduct',
    featureSlug: params.featureSlug,
    taskId: params.taskId,
    agentRoleId: params.agentRoleId,
    model: params.model,
    provider: params.provider,
    tokens: { input: params.inputTokens, output: params.outputTokens, total },
    cost: params.cost,
    currency: 'USD',
  };
  appendFileSync(TX_FILE(), JSON.stringify(tx) + '\n', 'utf8');

  return state;
}

/**
 * Check if budget allows a given token amount.
 *
 * @param {number} estimatedTokens
 * @param {number} estimatedCost
 * @returns {{ allowed: boolean, reason?: string, remaining: number }}
 */
export function checkBudget(estimatedTokens, estimatedCost) {
  const state = loadBudget();

  const dailyRemaining = state.daily.limit - state.daily.costUsed;
  if (estimatedCost > dailyRemaining) {
    return {
      allowed: false,
      reason: `Daily budget exceeded: $${state.daily.costUsed.toFixed(2)} of $${state.daily.limit} used`,
      remaining: dailyRemaining,
    };
  }

  return { allowed: true, remaining: dailyRemaining };
}

function updateAgentBudget(roleId, tokens, cost) {
  const agentDir = getAgentsDir(repoRoot());
  mkdirSync(agentDir, { recursive: true });
  const statePath = join(agentDir, `${roleId}.state.json`);
  let agentState = { roleId, tokensUsed: 0, tokensUsedToday: 0, costUsed: 0, costToday: 0, tasksCompleted: 0, tasksFailed: 0, escalations: 0, lastActiveAt: null, currentTask: null, history: [] };
  if (existsSync(statePath)) {
    agentState = JSON.parse(readFileSync(statePath, 'utf8'));
  }
  agentState.tokensUsed = (agentState.tokensUsed || 0) + tokens;
  agentState.tokensUsedToday = (agentState.tokensUsedToday || 0) + tokens;
  agentState.costUsed = (agentState.costUsed || 0) + cost;
  agentState.costToday = (agentState.costToday || 0) + cost;
  agentState.lastActiveAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(agentState, null, 2), 'utf8');
}

function writeBudget(state) {
  const dir = BUDGET_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE(), JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Generate budget report from state + transactions.
 *
 * @param {object} [opts]
 * @param {number} [opts.days] - Filter transactions to last N days
 * @param {string} [opts.featureSlug] - Filter to specific feature
 * @returns {object} Report with daily, monthly, byFeature, byModel, byRole breakdowns
 */
export function generateReport({ days, featureSlug } = {}) {
  const root = repoRoot();
  const state = loadBudget();

  // Load transactions
  const txPath = TX_FILE();
  let transactions = [];
  if (existsSync(txPath)) {
    transactions = readFileSync(txPath, 'utf8').trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  }

  // Filter by days window
  if (days) {
    const cutoff = Date.now() - days * 86400000;
    transactions = transactions.filter(tx =>
      new Date(tx.timestamp).getTime() > cutoff
    );
  }

  // Filter by feature
  if (featureSlug) {
    transactions = transactions.filter(tx => tx.featureSlug === featureSlug);
  }

  // Build breakdowns
  const byFeature = {};
  const byModel = {};
  const byRole = {};

  for (const tx of transactions) {
    const fKey = tx.featureSlug || 'unknown';
    if (!byFeature[fKey]) byFeature[fKey] = { cost: 0, tokens: 0, calls: 0 };
    byFeature[fKey].cost += tx.cost || 0;
    byFeature[fKey].tokens += tx.tokens?.total || 0;
    byFeature[fKey].calls += 1;

    const mKey = tx.model || 'unknown';
    if (!byModel[mKey]) byModel[mKey] = { cost: 0, tokens: 0, calls: 0 };
    byModel[mKey].cost += tx.cost || 0;
    byModel[mKey].tokens += tx.tokens?.total || 0;
    byModel[mKey].calls += 1;

    const rKey = tx.agentRoleId || 'unknown';
    if (!byRole[rKey]) byRole[rKey] = { cost: 0, tokens: 0, calls: 0 };
    byRole[rKey].cost += tx.cost || 0;
    byRole[rKey].tokens += tx.tokens?.total || 0;
    byRole[rKey].calls += 1;
  }

  return {
    daily: {
      spent: state.daily?.costUsed || 0,
      limit: state.daily?.limit || 50,
      tokens: state.daily?.tokensUsed || 0,
    },
    monthly: {
      spent: state.monthly?.costUsed || 0,
      limit: state.monthly?.limit || 1000,
      tokens: state.monthly?.tokensUsed || 0,
    },
    totalTransactions: transactions.length,
    byFeature,
    byModel,
    byRole,
  };
}

/**
 * Get per-role budget breakdown from the in-memory role tracker.
 */
export function getRoleBudgetBreakdown() {
  return _roleTracker.getAll();
}

/**
 * Check budget alerts for a specific role.
 */
export function checkRoleBudgetAlerts(roleId) {
  return _roleTracker.checkAlerts(roleId);
}

/**
 * Set a daily token quota for a role (enables alerts at 50%/75%/90%).
 */
export function setRoleQuota(roleId, dailyTokens) {
  _roleTracker.setQuota(roleId, dailyTokens);
}

/**
 * Estimate cost for a planned task using cost-calculator.
 */
export { estimateTaskCost };

/**
 * In-memory budget tracker (no file I/O).
 */
export function createBudgetTracker({ budget }) {
  let spent = 0;
  const categories = {};

  function spend(amount, category) {
    spent += amount;
    categories[category] = (categories[category] || 0) + amount;
  }

  function getRemaining() {
    return budget - spent;
  }

  function isOverBudget() {
    return spent > budget;
  }

  function getBreakdown() {
    return { ...categories };
  }

  return { spend, getRemaining, isOverBudget, getBreakdown };
}
