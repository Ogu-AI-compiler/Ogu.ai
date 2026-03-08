import { randomUUID } from 'node:crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * LLM Caller — Agent SDK interface (replaces Claude CLI subprocess).
 *
 * Model pricing (per 1K tokens):
 *   - haiku:  $0.001 input, $0.005 output
 *   - sonnet: $0.003 input, $0.015 output
 *   - opus:   $0.015 input, $0.075 output
 */

// ── Model pricing table ──

const MODEL_PRICING = {
  'haiku': { inputPer1k: 0.001, outputPer1k: 0.005 },
  'claude-3-haiku': { inputPer1k: 0.001, outputPer1k: 0.005 },
  'claude-3-5-haiku': { inputPer1k: 0.001, outputPer1k: 0.005 },
  'sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-sonnet-4': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'opus': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'claude-3-opus': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'claude-opus-4': { inputPer1k: 0.015, outputPer1k: 0.075 },
};

const DEFAULT_PRICING = { inputPer1k: 0.003, outputPer1k: 0.015 };

// Strip auth env vars so Agent SDK uses Claude's own stored OAT credentials
const AGENT_ENV = (() => {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
})();

/**
 * Call the LLM via Agent SDK and return full output.
 */
export async function callLLM({
  prompt,
  systemPrompt,
  model = 'sonnet',
  maxTokens = 4096,
  tools = [],
  cwd,
  env: extraEnv = {},
} = {}) {
  const sessionId = randomUUID().slice(0, 12);
  const startTime = Date.now();

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
  const env = extraEnv && Object.keys(extraEnv).length > 0
    ? { ...AGENT_ENV, ...extraEnv, CLAUDECODE: undefined, ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined }
    : AGENT_ENV;

  const result = query({
    prompt: fullPrompt,
    options: {
      model: model || undefined,
      maxTurns: 1,
      allowedTools: tools.length > 0 ? tools : [],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env,
    },
  });

  let output = '';
  for await (const msg of result) {
    if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
      for (const b of msg.message.content) {
        if (b.type === 'text') output += b.text;
      }
    }
    if (msg.type === 'result') {
      if (!msg.is_error) output = msg.result ?? output;
      const durationMs = Date.now() - startTime;
      const usage = estimateUsage(prompt, systemPrompt, output);
      return {
        sessionId,
        output,
        rawOutput: output,
        stderr: undefined,
        usage,
        cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
        durationMs,
        exitCode: msg.is_error ? 1 : 0,
        events: [],
      };
    }
  }

  const durationMs = Date.now() - startTime;
  const usage = estimateUsage(prompt, systemPrompt, output);
  return {
    sessionId, output, rawOutput: output, stderr: undefined,
    usage, cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
    durationMs, exitCode: 0, events: [],
  };
}

/**
 * Stream LLM output via callback (chunk by chunk as the model responds).
 */
export async function streamLLM({
  prompt,
  systemPrompt,
  model = 'sonnet',
  maxTokens = 4096,
  tools = [],
  cwd,
  env: extraEnv = {},
  onChunk,
} = {}) {
  if (typeof onChunk !== 'function') {
    throw new Error('streamLLM requires an onChunk callback');
  }

  const sessionId = randomUUID().slice(0, 12);
  const startTime = Date.now();

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
  const env = extraEnv && Object.keys(extraEnv).length > 0
    ? { ...AGENT_ENV, ...extraEnv, CLAUDECODE: undefined, ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined }
    : AGENT_ENV;

  const result = query({
    prompt: fullPrompt,
    options: {
      model: model || undefined,
      maxTurns: 1,
      allowedTools: tools.length > 0 ? tools : [],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env,
    },
  });

  let fullOutput = '';
  for await (const msg of result) {
    if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
      for (const b of msg.message.content) {
        if (b.type === 'text') {
          fullOutput += b.text;
          onChunk(b.text, msg);
        }
      }
    }
    if (msg.type === 'result') {
      if (!msg.is_error) fullOutput = msg.result ?? fullOutput;
      const durationMs = Date.now() - startTime;
      const usage = estimateUsage(prompt, systemPrompt, fullOutput);
      return {
        sessionId, output: fullOutput, rawOutput: fullOutput, stderr: undefined,
        usage, cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
        durationMs, exitCode: msg.is_error ? 1 : 0, events: [],
      };
    }
  }

  const durationMs = Date.now() - startTime;
  const usage = estimateUsage(prompt, systemPrompt, fullOutput);
  return {
    sessionId, output: fullOutput, rawOutput: fullOutput, stderr: undefined,
    usage, cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
    durationMs, exitCode: 0, events: [],
  };
}

// Keep for backward compat — callers that parse stream-json events
export function parseLLMOutput(rawOutput) {
  return { text: rawOutput || '', usage: null, events: [] };
}

export function computeTokenCost(model, inputTokens, outputTokens) {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const lm = (model || '').toLowerCase();
    if (lm.includes('haiku')) pricing = MODEL_PRICING['haiku'];
    else if (lm.includes('opus')) pricing = MODEL_PRICING['opus'];
    else if (lm.includes('sonnet')) pricing = MODEL_PRICING['sonnet'];
    else pricing = DEFAULT_PRICING;
  }
  const inputCost  = (inputTokens  / 1000) * pricing.inputPer1k;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
  return {
    inputCost: round6(inputCost), outputCost: round6(outputCost),
    totalCost: round6(inputCost + outputCost), model: model || 'unknown',
    pricing: { inputPer1k: pricing.inputPer1k, outputPer1k: pricing.outputPer1k },
  };
}

function estimateUsage(prompt, systemPrompt, output) {
  const inputText = (prompt || '') + (systemPrompt || '');
  return {
    inputTokens:  Math.max(1, Math.ceil(inputText.length / 4)),
    outputTokens: Math.max(1, Math.ceil((output || '').length / 4)),
  };
}

function round6(n) { return Math.round(n * 1000000) / 1000000; }
