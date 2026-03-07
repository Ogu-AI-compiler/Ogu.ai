/**
 * LLM Client — unified interface for calling language models.
 *
 * Supports:
 *   - simulate: true — returns canned responses with realistic token counts
 *   - provider: 'anthropic' — calls Anthropic Messages API (when API key is set)
 *
 * No external dependencies — uses native fetch.
 */

import { estimateTokens as countTokens, countMessages } from './token-counter.mjs';
import { createContextWindowManager } from './context-window-manager.mjs';

/**
 * Call an LLM.
 *
 * @param {object} options
 * @param {string} options.provider - Provider ID (anthropic)
 * @param {string} options.model - Model ID
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.system] - System prompt
 * @param {number} [options.maxTokens=4096]
 * @param {number} [options.temperature=0]
 * @param {boolean} [options.simulate=false] - Use simulated response
 * @param {Array<{path: string, content: string}>} [options.simulateFiles] - Files for simulated response
 * @returns {Promise<{content: string, files: Array, usage: {inputTokens: number, outputTokens: number}}>}
 */
export async function callLLM(options) {
  const {
    provider,
    model,
    messages,
    system = '',
    maxTokens = 4096,
    temperature = 0,
    simulate = false,
    simulateFiles = [],
  } = options;

  if (simulate) {
    console.warn('[llm] simulate requested but disabled — forcing real API call');
  }

  // Pre-call token estimation using token-counter
  const systemTokens = countTokens(system);
  const messageTokens = countMessages(messages);
  const estimatedInputTokens = systemTokens + messageTokens;

  // Context window check using context-window-manager
  // Note: MODEL_OUTPUT_LIMITS is for max_tokens (output cap), NOT context window.
  // All current Claude models have a 200K context window.
  const contextWindowLimit = 200000;
  const ctxManager = createContextWindowManager({ maxTokens: contextWindowLimit });
  const allocation = ctxManager.allocate('request', estimatedInputTokens + maxTokens);
  if (!allocation.success) {
    throw new Error(
      `Context window overflow: request needs ~${estimatedInputTokens + maxTokens} tokens ` +
      `but model "${model}" has ${contextWindowLimit} token limit (remaining: ${allocation.remaining})`
    );
  }

  if (provider === 'anthropic') {
    return callAnthropic({ model, messages, system, maxTokens, temperature });
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Calculate cost from token usage and model pricing.
 *
 * @param {{inputTokens: number, outputTokens: number}} usage
 * @param {number} costPer1kInput
 * @param {number} costPer1kOutput
 * @returns {number} Cost in USD
 */
export function calculateCost(usage, costPer1kInput, costPer1kOutput) {
  return (usage.inputTokens / 1000) * costPer1kInput
       + (usage.outputTokens / 1000) * costPer1kOutput;
}

/**
 * Rough token estimation (chars / 4 heuristic).
 * Good enough for budget checks; actual counts come from API response.
 * Delegates to token-counter for consistent estimation.
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, countTokens(text));
}

// ── Simulate Mode ──

function simulateResponse(messages, system, simulateFiles) {
  // Estimate input tokens from all message content + system
  const inputText = system + messages.map(m => m.content).join('\n');
  const inputTokens = estimateTokens(inputText);

  // Estimate output tokens from simulated files
  const outputText = simulateFiles.map(f => f.content).join('\n');
  const outputTokens = Math.max(10, estimateTokens(outputText));

  return {
    content: simulateFiles.length > 0
      ? `Created ${simulateFiles.length} file(s): ${simulateFiles.map(f => f.path).join(', ')}`
      : 'Task completed successfully.',
    files: simulateFiles.map(f => ({
      path: f.path,
      content: f.content,
    })),
    usage: {
      inputTokens,
      outputTokens,
    },
  };
}

// ── Anthropic API ──

// Per-model output token limits (from Anthropic API docs)
const MODEL_OUTPUT_LIMITS = {
  'claude-haiku-4-5-20251001': 8192,
  'claude-sonnet-4-6': 16384,
  'claude-opus-4-6': 32768,
};

async function callAnthropic({ model, messages, system, maxTokens, temperature }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  // Cap max_tokens at the model's known output limit to avoid API rejection
  const modelLimit = MODEL_OUTPUT_LIMITS[model] || 8192;
  const cappedMaxTokens = Math.min(maxTokens, modelLimit);

  const body = {
    model,
    max_tokens: cappedMaxTokens,
    temperature,
    messages,
  };

  if (system) {
    body.system = system;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // Extract text content
  const textBlocks = data.content.filter(b => b.type === 'text');
  const content = textBlocks.map(b => b.text).join('\n');

  return {
    content,
    files: [], // Real API doesn't return files directly — needs response-parser
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
}
