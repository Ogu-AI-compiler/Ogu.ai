/**
 * Response Parser — converts LLM responses into OutputEnvelope format.
 *
 * Extracts file operations, token counts, and calculates cost.
 */

/**
 * Parse an LLM response into structured output.
 *
 * @param {object} llmResponse - Raw response from callLLM
 * @param {string} llmResponse.content - Text content
 * @param {Array<{path: string, content: string}>} llmResponse.files - File outputs
 * @param {{inputTokens: number, outputTokens: number}} llmResponse.usage - Token usage
 * @param {object} [modelPricing] - Optional pricing info
 * @param {number} [modelPricing.costPer1kInput]
 * @param {number} [modelPricing.costPer1kOutput]
 * @returns {{
 *   files: Array<{path: string, action: string, content: string, linesAdded: number, linesRemoved: number}>,
 *   tokensUsed: {input: number, output: number, total: number},
 *   cost: number,
 *   content: string
 * }}
 */
export function parseResponse(llmResponse, modelPricing = {}) {
  const { content = '', files = [], usage = {} } = llmResponse;

  // Parse files
  const parsedFiles = files.map(f => ({
    path: f.path,
    action: 'created',
    content: f.content || '',
    linesAdded: (f.content || '').split('\n').length,
    linesRemoved: 0,
  }));

  // Token counts
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const tokensUsed = {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
  };

  // Cost calculation
  const costPer1kInput = modelPricing.costPer1kInput || 0;
  const costPer1kOutput = modelPricing.costPer1kOutput || 0;
  const cost = (inputTokens / 1000) * costPer1kInput
             + (outputTokens / 1000) * costPer1kOutput;

  return {
    files: parsedFiles,
    tokensUsed,
    cost,
    content,
  };
}
