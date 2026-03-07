/**
 * Response Parser — converts LLM responses into OutputEnvelope format.
 *
 * Extracts file operations from:
 *   1. llmResponse.files (simulate mode — pre-structured)
 *   2. llmResponse.content text (real API — parses FILE: blocks and code fences)
 *
 * Also calculates token counts and cost.
 */

/**
 * Extract file blocks from LLM text output.
 *
 * Supported formats:
 *   FILE: path/to/file.ts
 *   ```
 *   content
 *   ```
 *
 *   Also: ```typescript, ```tsx, ```json, etc.
 *
 * @param {string} text - LLM response text
 * @returns {Array<{path: string, content: string}>}
 */
function extractFilesFromText(text) {
  if (!text) return [];

  const files = [];

  // Pattern: FILE: <path>\n```[lang]\n...\n```
  const fileBlockRegex = /FILE:\s*(\S+)\s*\n```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = fileBlockRegex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2];
    if (path && content) {
      files.push({ path, content: content.trimEnd() });
    }
  }

  // If FILE: blocks found, return them
  if (files.length > 0) return files;

  // Fallback: look for ### path\n```\n...\n``` or **path**\n```\n...\n```
  const headerBlockRegex = /(?:###?\s*|[*]{2})([^\n*]+\.(?:tsx?|jsx?|mjs|css|json|md|html))\s*[*]{0,2}\s*\n```[^\n]*\n([\s\S]*?)```/g;
  while ((match = headerBlockRegex.exec(text)) !== null) {
    const path = match[1].trim().replace(/^`|`$/g, '');
    const content = match[2];
    if (path && content && !path.includes(' ')) {
      files.push({ path, content: content.trimEnd() });
    }
  }

  return files;
}

/**
 * Parse an LLM response into structured output.
 *
 * @param {object} llmResponse - Raw response from callLLM
 * @param {string} llmResponse.content - Text content
 * @param {Array<{path: string, content: string}>} llmResponse.files - File outputs (simulate mode)
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

  // Parse files from structured response (simulate mode)
  let allFiles = files.map(f => ({
    path: f.path,
    action: 'created',
    content: f.content || '',
    linesAdded: (f.content || '').split('\n').length,
    linesRemoved: 0,
  }));

  // If no structured files, extract from text content (real API mode)
  if (allFiles.length === 0 && content) {
    const extracted = extractFilesFromText(content);
    allFiles = extracted.map(f => ({
      path: f.path,
      action: 'created',
      content: f.content,
      linesAdded: f.content.split('\n').length,
      linesRemoved: 0,
    }));
  }

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
    files: allFiles,
    tokensUsed,
    cost,
    content,
  };
}
