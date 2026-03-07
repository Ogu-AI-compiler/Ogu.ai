/**
 * pricing-engine.mjs — Slice 371
 * Computes agent prices from tier config + performance stats.
 * Creates default config files on first call if missing.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getMarketplaceDir } from "./runtime-paths.mjs";

const DEFAULT_TIERS = {
  "1": { model_cost: 1,  commission: 0.5 },
  "2": { model_cost: 3,  commission: 1   },
  "3": { model_cost: 6,  commission: 2   },
  "4": { model_cost: 12, commission: 4   },
};

const DEFAULT_MULTIPLIERS = {
  weights:  { success_rate: 0.5, projects_completed: 0.3, utilization: 0.2 },
  floor:    0.5,
  ceiling:  2.0,
};

function pricingDir(root) {
  return join(getMarketplaceDir(root), "pricing");
}

function ensurePricingConfig(root) {
  const dir = pricingDir(root);
  mkdirSync(dir, { recursive: true });

  const tiersPath = join(dir, "tiers.json");
  if (!existsSync(tiersPath)) {
    writeFileSync(tiersPath, JSON.stringify(DEFAULT_TIERS, null, 2) + "\n", "utf-8");
  }

  const multipliersPath = join(dir, "multipliers.json");
  if (!existsSync(multipliersPath)) {
    writeFileSync(multipliersPath, JSON.stringify(DEFAULT_MULTIPLIERS, null, 2) + "\n", "utf-8");
  }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return null; }
}

/**
 * loadPricingConfig(root) → { tiers, multipliers }
 */
export function loadPricingConfig(root) {
  ensurePricingConfig(root);
  const dir = pricingDir(root);
  return {
    tiers:       readJson(join(dir, "tiers.json"))       || DEFAULT_TIERS,
    multipliers: readJson(join(dir, "multipliers.json")) || DEFAULT_MULTIPLIERS,
  };
}

/**
 * computeBasePrice(root, tier) → number
 * base_price = model_cost + commission
 */
export function computeBasePrice(root, tier) {
  const { tiers } = loadPricingConfig(root);
  const t = tiers[String(tier)];
  if (!t) throw new Error(`Unknown tier: ${tier}`);
  return t.model_cost + t.commission;
}

/**
 * computeMultiplier(root, stats) → float (clamped to floor..ceiling)
 * stats: { success_rate, projects_completed, utilization_units, capacity_units }
 */
export function computeMultiplier(root, stats) {
  const { multipliers } = loadPricingConfig(root);
  const { weights, floor, ceiling } = multipliers;

  const sr  = (stats.success_rate ?? 0.8);
  const pc  = Math.min(1, (stats.projects_completed ?? 0) / 20); // normalize: 20 projects → 1.0
  const util = stats.capacity_units > 0
    ? Math.min(1, (stats.utilization_units ?? 0) / stats.capacity_units)
    : 0;

  const raw = (sr * weights.success_rate)
            + (pc * weights.projects_completed)
            + (util * weights.utilization);

  // raw is 0..1 — map to floor..ceiling
  const mult = floor + raw * (ceiling - floor);
  return Math.max(floor, Math.min(ceiling, mult));
}

/**
 * computeFinalPrice(root, agent) → number
 */
export function computeFinalPrice(root, agent) {
  const base = computeBasePrice(root, agent.tier);
  const mult = agent.performance_multiplier ?? computeMultiplier(root, {
    ...agent.stats,
    capacity_units: agent.capacity_units,
  });
  return Math.round(base * mult * 100) / 100;
}

/**
 * updateAgentMultiplier(root, agentId, stats) → { multiplier }
 * Recalculates and returns new multiplier (caller saves to agent profile).
 */
export function updateAgentMultiplier(root, agentId, stats) {
  const mult = computeMultiplier(root, stats);
  return { multiplier: mult };
}
