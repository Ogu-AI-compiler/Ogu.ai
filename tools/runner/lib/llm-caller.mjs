import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

/**
 * LLM Caller — spawn Claude CLI process with streaming output.
 *
 * This module handles the actual invocation of the Claude CLI binary,
 * capturing streaming output, parsing structured events, and computing
 * token costs. It is the lowest-level LLM interface in the runner stack.
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

// Fallback for unknown models
const DEFAULT_PRICING = { inputPer1k: 0.003, outputPer1k: 0.015 };

/**
 * Call the Claude CLI and capture full output.
 *
 * Spawns `claude` as a child process with the given prompt, waits for
 * completion, and returns structured results including usage and cost.
 *
 * @param {object} options
 * @param {string} options.prompt - User prompt text
 * @param {string} [options.systemPrompt] - System prompt
 * @param {string} [options.model='sonnet'] - Model name
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {string[]} [options.tools=[]] - Tool names to enable
 * @param {string} [options.cwd] - Working directory for the CLI process
 * @param {object} [options.env={}] - Additional environment variables
 * @returns {Promise<object>} { sessionId, output, usage, durationMs, exitCode }
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

  return new Promise((resolve, reject) => {
    // Build CLI arguments
    const args = buildCLIArgs({ prompt, systemPrompt, model, maxTokens, tools, outputFormat: 'stream-json' });

    // Build env
    const procEnv = {
      ...process.env,
      ...extraEnv,
    };

    const child = spawn('claude', args, {
      cwd: cwd || process.cwd(),
      env: procEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      reject(new Error(`Failed to spawn Claude CLI: ${err.message} (after ${durationMs}ms)`));
    });

    child.on('close', (exitCode) => {
      const durationMs = Date.now() - startTime;

      // Parse the output to extract usage info
      const parsed = parseLLMOutput(stdout);

      // Estimate tokens if not available from parsed output
      const usage = parsed.usage || estimateUsage(prompt, systemPrompt, stdout);

      resolve({
        sessionId,
        output: parsed.text || stdout,
        rawOutput: stdout,
        stderr: stderr || undefined,
        usage,
        cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
        durationMs,
        exitCode: exitCode || 0,
        events: parsed.events,
      });
    });

    // Write prompt to stdin if not passed as arg
    if (prompt && !args.includes('-p')) {
      child.stdin.write(prompt);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

/**
 * Stream Claude CLI output via callback.
 *
 * Same as callLLM but invokes onChunk for each piece of output received,
 * allowing real-time streaming to the UI or logs.
 *
 * @param {object} options
 * @param {string} options.prompt - User prompt text
 * @param {string} [options.systemPrompt] - System prompt
 * @param {string} [options.model='sonnet'] - Model name
 * @param {number} [options.maxTokens=4096] - Max output tokens
 * @param {string[]} [options.tools=[]] - Tool names to enable
 * @param {string} [options.cwd] - Working directory
 * @param {object} [options.env={}] - Additional env vars
 * @param {function} options.onChunk - Callback: (chunk: string, event?: object) => void
 * @returns {Promise<object>} Same as callLLM
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

  return new Promise((resolve, reject) => {
    const args = buildCLIArgs({ prompt, systemPrompt, model, maxTokens, tools, outputFormat: 'stream-json' });

    const procEnv = {
      ...process.env,
      ...extraEnv,
    };

    const child = spawn('claude', args, {
      cwd: cwd || process.cwd(),
      env: procEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let fullOutput = '';
    let stderr = '';
    let lineBuffer = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      fullOutput += text;

      // Parse stream-json line by line
      lineBuffer += text;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          onChunk(trimmed, event);
        } catch {
          // Not JSON — raw text output
          onChunk(trimmed, null);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });

    child.on('close', (exitCode) => {
      // Flush remaining buffer
      if (lineBuffer.trim()) {
        try {
          const event = JSON.parse(lineBuffer.trim());
          onChunk(lineBuffer.trim(), event);
        } catch {
          onChunk(lineBuffer.trim(), null);
        }
      }

      const durationMs = Date.now() - startTime;
      const parsed = parseLLMOutput(fullOutput);
      const usage = parsed.usage || estimateUsage(prompt, systemPrompt, fullOutput);

      resolve({
        sessionId,
        output: parsed.text || fullOutput,
        rawOutput: fullOutput,
        stderr: stderr || undefined,
        usage,
        cost: computeTokenCost(model, usage.inputTokens, usage.outputTokens),
        durationMs,
        exitCode: exitCode || 0,
        events: parsed.events,
      });
    });

    if (prompt && !args.includes('-p')) {
      child.stdin.write(prompt);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

/**
 * Parse Claude CLI stream-json output into structured events.
 *
 * The Claude CLI with `--output-format stream-json` emits one JSON object
 * per line. This function collects all events and extracts:
 *   - text: concatenated assistant text
 *   - usage: token counts from the result event
 *   - events: array of all parsed events
 *
 * @param {string} rawOutput - Raw stdout from Claude CLI
 * @returns {{ text: string, usage: object|null, events: object[] }}
 */
export function parseLLMOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return { text: '', usage: null, events: [] };
  }

  const events = [];
  let text = '';
  let usage = null;

  const lines = rawOutput.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const event = JSON.parse(trimmed);
      events.push(event);

      // Extract text from assistant message events
      if (event.type === 'assistant' && event.message) {
        // Claude CLI assistant messages
        if (typeof event.message === 'string') {
          text += event.message;
        } else if (event.message.content) {
          // Structured content blocks
          const blocks = Array.isArray(event.message.content)
            ? event.message.content
            : [event.message.content];
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              text += block.text;
            }
          }
        }
      }

      // Extract text from content_block_delta
      if (event.type === 'content_block_delta' && event.delta?.text) {
        text += event.delta.text;
      }

      // Extract usage from result/message_stop events
      if (event.type === 'result' && event.result?.usage) {
        usage = {
          inputTokens: event.result.usage.input_tokens || 0,
          outputTokens: event.result.usage.output_tokens || 0,
        };
      }
      if (event.type === 'message_stop' && event.usage) {
        usage = {
          inputTokens: event.usage.input_tokens || 0,
          outputTokens: event.usage.output_tokens || 0,
        };
      }
    } catch {
      // Not JSON — treat as raw text
      text += trimmed + '\n';
    }
  }

  return { text: text.trim(), usage, events };
}

/**
 * Calculate cost based on model pricing.
 *
 * @param {string} model - Model name (haiku, sonnet, opus, or full model ID)
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {{ inputCost: number, outputCost: number, totalCost: number, model: string }}
 */
export function computeTokenCost(model, inputTokens, outputTokens) {
  // Resolve pricing — try exact match, then partial match, then default
  let pricing = MODEL_PRICING[model];

  if (!pricing) {
    // Try partial match (e.g., 'claude-3-5-sonnet-20241022' should match 'sonnet')
    const lowerModel = (model || '').toLowerCase();
    if (lowerModel.includes('haiku')) {
      pricing = MODEL_PRICING['haiku'];
    } else if (lowerModel.includes('opus')) {
      pricing = MODEL_PRICING['opus'];
    } else if (lowerModel.includes('sonnet')) {
      pricing = MODEL_PRICING['sonnet'];
    } else {
      pricing = DEFAULT_PRICING;
    }
  }

  const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k;

  return {
    inputCost: round6(inputCost),
    outputCost: round6(outputCost),
    totalCost: round6(inputCost + outputCost),
    model: model || 'unknown',
    pricing: {
      inputPer1k: pricing.inputPer1k,
      outputPer1k: pricing.outputPer1k,
    },
  };
}

// ── Internal helpers ──

/**
 * Build CLI arguments array for the claude command.
 */
function buildCLIArgs({ prompt, systemPrompt, model, maxTokens, tools, outputFormat }) {
  const args = [];

  // Prompt
  if (prompt) {
    args.push('-p', prompt);
  }

  // System prompt
  if (systemPrompt) {
    args.push('--system', systemPrompt);
  }

  // Model
  if (model) {
    args.push('--model', model);
  }

  // Max tokens
  if (maxTokens) {
    args.push('--max-tokens', String(maxTokens));
  }

  // Output format
  if (outputFormat) {
    args.push('--output-format', outputFormat);
  }

  // Tools
  if (tools && tools.length > 0) {
    for (const tool of tools) {
      args.push('--tool', tool);
    }
  }

  return args;
}

/**
 * Estimate token usage when actual counts are not available.
 * Uses ~4 chars per token heuristic.
 */
function estimateUsage(prompt, systemPrompt, output) {
  const inputText = (prompt || '') + (systemPrompt || '');
  const inputTokens = Math.max(1, Math.ceil(inputText.length / 4));
  const outputTokens = Math.max(1, Math.ceil((output || '').length / 4));
  return { inputTokens, outputTokens };
}

/**
 * Round to 6 decimal places (avoids floating point noise).
 */
function round6(n) {
  return Math.round(n * 1000000) / 1000000;
}
