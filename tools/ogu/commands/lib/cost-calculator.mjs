/**
 * Cost Calculator — calculate LLM costs from token usage and model pricing.
 */

export const MODEL_PRICING = {
  haiku:  { costPer1kIn: 0.00025, costPer1kOut: 0.00125 },
  sonnet: { costPer1kIn: 0.003,   costPer1kOut: 0.015 },
  opus:   { costPer1kIn: 0.015,   costPer1kOut: 0.075 },
};

/**
 * Calculate cost from tokens and model.
 */
export function calculateCost({ model, tokensIn, tokensOut }) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new Error(`Unknown model: ${model}`);

  return (tokensIn / 1000) * pricing.costPer1kIn +
         (tokensOut / 1000) * pricing.costPer1kOut;
}

/**
 * Estimate cost for a task based on prompt/output length.
 */
export function estimateTaskCost({ model, promptLength, expectedOutputLength }) {
  const tokensIn = Math.ceil(promptLength / 4);
  const tokensOut = Math.ceil(expectedOutputLength / 4);
  const cost = calculateCost({ model, tokensIn, tokensOut });
  return { cost, tokensIn, tokensOut, model };
}
