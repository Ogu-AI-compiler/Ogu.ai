/**
 * Cost Estimator — estimate token costs before LLM calls.
 */

/**
 * Model pricing per 1M tokens (USD).
 */
export const MODEL_PRICING = {
  'claude-opus':   { input: 15.00, output: 75.00 },
  'claude-sonnet': { input: 3.00,  output: 15.00 },
  'claude-haiku':  { input: 0.25,  output: 1.25 },
  'gpt-4':         { input: 30.00, output: 60.00 },
  'gpt-4o':        { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':   { input: 0.15,  output: 0.60 },
};

/**
 * Estimate cost for a known token count.
 *
 * @param {{ inputTokens: number, outputTokens: number, model: string }} opts
 * @returns {{ inputCost: number, outputCost: number, totalCost: number, model: string }}
 */
export function estimateCost({ inputTokens, outputTokens, model }) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
    model,
  };
}

/**
 * Estimate cost for a task based on description length.
 *
 * Uses heuristic: input ~= description tokens * 3 (context expansion),
 * output ~= input * 2 (code generation ratio).
 *
 * @param {{ taskDescription: string, model: string }} opts
 * @returns {{ estimatedInputTokens: number, estimatedOutputTokens: number, estimatedCost: number }}
 */
export function estimateTaskCost({ taskDescription, model }) {
  const descTokens = Math.ceil((taskDescription || '').length / 4);
  const estimatedInputTokens = descTokens * 3;
  const estimatedOutputTokens = descTokens * 2;
  const cost = estimateCost({ inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens, model });
  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost: cost.totalCost,
    model,
  };
}

/**
 * Format a cost as a human-readable string.
 *
 * @param {number} cost - Cost in USD
 * @returns {string}
 */
export function formatCost(cost) {
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Generic cost estimator with custom rates.
 */
export function createCostEstimator() {
  const rates = new Map();

  function addRate(type, costPerUnit) {
    rates.set(type, costPerUnit);
  }

  function estimate(items) {
    let total = 0;
    for (const item of items) {
      const rate = rates.get(item.type);
      if (rate === undefined) throw new Error(`Unknown cost type: ${item.type}`);
      total += rate * item.quantity;
    }
    return total;
  }

  return { addRate, estimate };
}
