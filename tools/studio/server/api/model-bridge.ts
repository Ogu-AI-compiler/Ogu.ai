/**
 * Model Bridge — connects Studio chat to Ogu's model router and budget tracker.
 *
 * Reads OrgSpec.json and model-config.json to make routing decisions.
 * Records token spend to budget state files.
 * Avoids ESM/TS import issues by reading JSON files directly.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getBudgetDir, resolveOguPath, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";

// ── Types ──

export interface RoutingDecision {
  provider: string;
  model: string;        // claude CLI model name: "sonnet", "opus", "haiku"
  fullModelId: string;
  reason: string;
  tier: number;
}

interface ModelConfig {
  providers: Array<{
    id: string;
    enabled: boolean;
    models: Array<{
      id: string;
      fullId: string;
      tier: number;
      costPer1kInput: number;
      costPer1kOutput: number;
      maxTokens: number;
    }>;
  }>;
  routingPolicies: Record<string, { preferTier?: number; escalateOnFailure?: boolean; maxEscalations?: number }>;
  activePolicy: string;
}

export interface SpendRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  sessionId?: string;
  phase?: string;
  featureSlug?: string;
}

// ── Default model config (matches model-router.mjs defaults) ──

const DEFAULT_CONFIG: ModelConfig = {
  providers: [{
    id: "anthropic",
    enabled: true,
    models: [
      { id: "haiku", fullId: "claude-haiku-4-5-20251001", tier: 1, costPer1kInput: 0.001, costPer1kOutput: 0.005, maxTokens: 200000 },
      { id: "sonnet", fullId: "claude-sonnet-4-6-20250514", tier: 2, costPer1kInput: 0.003, costPer1kOutput: 0.015, maxTokens: 200000 },
      { id: "opus", fullId: "claude-opus-4-6-20250514", tier: 3, costPer1kInput: 0.015, costPer1kOutput: 0.075, maxTokens: 200000 },
    ],
  }],
  routingPolicies: { balanced: { preferTier: undefined, escalateOnFailure: true, maxEscalations: 2 } },
  activePolicy: "balanced",
};

// Model cost lookup (cost per 1k tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  haiku:  { input: 0.001,  output: 0.005 },
  sonnet: { input: 0.003,  output: 0.015 },
  opus:   { input: 0.015,  output: 0.075 },
};

// ── Phase-to-tier mapping ──

const PHASE_TIER: Record<string, number> = {
  discovery: 1,       // haiku — cheap, fast for Q&A
  feature: 2,         // sonnet — good reasoning for PRDs
  architect: 2,       // sonnet — architecture design
  preflight: 1,       // haiku — running checks
  build: 2,           // sonnet — code generation
  gates: 2,           // sonnet — verification
  deliver: 1,         // haiku — deployment
};

// ── Core functions ──

function loadModelConfig(root: string): ModelConfig {
  const configPath = resolveOguPath(root, "model-config.json");
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, "utf8"));
    } catch { /* fall through */ }
  }
  return DEFAULT_CONFIG;
}

function loadBudgetState(root: string): { dailyLimit: number; todaySpent: number } {
  const budgetPath = join(getBudgetDir(root), "budget-state.json");
  const orgPath = resolveOguPath(root, "OrgSpec.json");

  let dailyLimit = 10; // $10 default
  if (existsSync(orgPath)) {
    try {
      const org = JSON.parse(readFileSync(orgPath, "utf8"));
      dailyLimit = org.budget?.dailyLimit || org.defaults?.budgetQuota?.dailyDollars || 10;
    } catch { /* use default */ }
  }

  let todaySpent = 0;
  if (existsSync(budgetPath)) {
    try {
      const state = JSON.parse(readFileSync(budgetPath, "utf8"));
      const today = new Date().toISOString().slice(0, 10);
      todaySpent = state.daily?.[today]?.spent || 0;
    } catch { /* use 0 */ }
  }

  return { dailyLimit, todaySpent };
}

/**
 * Route model selection for a Studio chat request.
 *
 * @param root — project root
 * @param requestedModel — user-selected model (optional)
 * @param phase — current pipeline phase
 * @returns routing decision with model name for claude CLI
 */
export function routeChat(root: string, requestedModel?: string, phase?: string): RoutingDecision {
  const config = loadModelConfig(root);

  // 1. Explicit model request — validate and use
  if (requestedModel) {
    for (const provider of config.providers.filter(p => p.enabled)) {
      const model = provider.models.find(m => m.id === requestedModel);
      if (model) {
        logRouting(root, { model: model.id, reason: "explicit-request", phase });
        return {
          provider: provider.id,
          model: model.id,
          fullModelId: model.fullId,
          reason: "explicit-request",
          tier: model.tier,
        };
      }
    }
  }

  // 2. Phase-based tier selection
  const targetTier = PHASE_TIER[phase || "build"] || 2;

  // 3. Budget check — downgrade if exhausted
  const budget = loadBudgetState(root);
  let effectiveTier = targetTier;
  let reason = "phase-default";

  if (budget.todaySpent >= budget.dailyLimit) {
    effectiveTier = 1;
    reason = "budget-exhausted";
  } else if (budget.todaySpent >= budget.dailyLimit * 0.8) {
    effectiveTier = Math.min(effectiveTier, 2);
    reason = "budget-warning";
  }

  // 4. Find best model at tier
  for (const provider of config.providers.filter(p => p.enabled)) {
    const candidates = provider.models
      .filter(m => m.tier <= effectiveTier)
      .sort((a, b) => b.tier - a.tier);

    if (candidates.length > 0) {
      const selected = candidates[0];
      logRouting(root, { model: selected.id, reason, phase, tier: effectiveTier });
      return {
        provider: provider.id,
        model: selected.id,
        fullModelId: selected.fullId,
        reason,
        tier: selected.tier,
      };
    }
  }

  // Fallback — sonnet
  logRouting(root, { model: "sonnet", reason: "fallback", phase });
  return {
    provider: "anthropic",
    model: "sonnet",
    fullModelId: "claude-sonnet-4-6-20250514",
    reason: "fallback",
    tier: 2,
  };
}

/**
 * Record token spend from a completed chat turn.
 */
export function recordChatSpend(root: string, record: SpendRecord): void {
  const budgetDir = getBudgetDir(root);
  mkdirSync(budgetDir, { recursive: true });

  // Append to transactions log
  const txPath = join(budgetDir, "transactions.jsonl");
  try {
    appendFileSync(txPath, JSON.stringify(record) + "\n", "utf8");
  } catch { /* best effort */ }

  // Update daily budget state
  const statePath = join(budgetDir, "budget-state.json");
  let state: any = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, "utf8")); } catch { state = {}; }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!state.daily) state.daily = {};
  if (!state.daily[today]) state.daily[today] = { spent: 0, tokens: 0, calls: 0 };

  state.daily[today].spent += record.cost;
  state.daily[today].tokens += record.inputTokens + record.outputTokens;
  state.daily[today].calls += 1;
  state.lastUpdated = new Date().toISOString();

  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch { /* best effort */ }
}

/**
 * Compute cost from token counts and model name.
 */
export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS.sonnet;
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

/**
 * Get current budget status.
 */
export function getBudgetStatus(root: string): {
  dailyLimit: number;
  todaySpent: number;
  remaining: number;
  percentage: number;
  status: "ok" | "warning" | "exhausted";
} {
  const { dailyLimit, todaySpent } = loadBudgetState(root);
  const remaining = Math.max(0, dailyLimit - todaySpent);
  const percentage = dailyLimit > 0 ? Math.round((todaySpent / dailyLimit) * 100) : 0;
  const status = percentage >= 100 ? "exhausted" : percentage >= 80 ? "warning" : "ok";
  return { dailyLimit, todaySpent, remaining, percentage, status };
}

// ── Internal ──

function logRouting(root: string, data: Record<string, any>): void {
  const logDir = resolveRuntimePath(root, "");
  mkdirSync(logDir, { recursive: true });
  const entry = { timestamp: new Date().toISOString(), source: "studio-chat", ...data };
  try {
    appendFileSync(join(logDir, "model-log.jsonl"), JSON.stringify(entry) + "\n");
  } catch { /* best effort */ }
}
