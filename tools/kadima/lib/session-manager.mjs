/**
 * session-manager.mjs — Pipeline LLM session management.
 *
 * Uses claude CLI's --session-id / --resume flags to share conversation
 * context across sequential LLM calls in a pipeline.
 *
 * Benefits:
 *   - Context is maintained between calls — no need to re-send previous outputs
 *   - Subsequent calls in a pipeline send tiny prompts instead of huge inputs
 *   - One process startup overhead per call (same as before), but input size
 *     drops from 15,000 tokens to ~50 tokens for steps 2+
 *
 * Usage:
 *   const session = createPipelineSession();
 *
 *   // First call — establishes session with context
 *   const prd = await session.call('Write a PRD for: ' + brief, {
 *     model: 'sonnet', system: 'You are a PM...', isFirst: true
 *   });
 *
 *   // Subsequent calls — tiny prompt, full context carried over
 *   const spec = await session.call('Now write the Technical Spec.', {
 *     model: 'sonnet'
 *   });
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 240_000; // 4 minutes per call

// ── Core spawn helper ─────────────────────────────────────────────────────────

function spawnClaude(args, timeout = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    const child = spawn('claude', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`session-manager: timeout after ${timeout / 1000}s`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const hint = stderr.slice(0, 400);
        reject(new Error(`claude exited ${code}: ${hint}`));
        return;
      }
      // --output-format json returns a single JSON object
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.is_error) {
          reject(new Error(`claude error: ${parsed.result || parsed.error}`));
          return;
        }
        resolve(parsed.result ?? parsed.text ?? parsed.content ?? stdout.trim());
      } catch {
        // Fallback: return raw stdout (e.g. plain text mode)
        resolve(stdout.trim());
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// ── PipelineSession class ─────────────────────────────────────────────────────

class PipelineSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.callCount = 0;
  }

  /**
   * Make an LLM call within this session.
   *
   * @param {string} prompt       — The user prompt for this step
   * @param {object} opts
   * @param {string} opts.model   — 'haiku' | 'sonnet' | 'opus' (default: 'sonnet')
   * @param {string} opts.system  — System prompt (only used on isFirst=true calls)
   * @param {boolean} opts.isFirst — Force first-call behavior (sets --session-id)
   * @param {number} opts.timeout — Per-call timeout in ms
   * @returns {Promise<string>}   — The LLM response text
   */
  async call(prompt, { model = 'sonnet', system = null, isFirst = false, timeout = DEFAULT_TIMEOUT_MS } = {}) {
    const isFirstCall = isFirst || this.callCount === 0;
    this.callCount++;

    const modelId = resolveModel(model);
    const args = [
      '-p', prompt,
      '--model', modelId,
      '--output-format', 'json',
    ];

    // System prompt only on first call — session carries it forward
    if (isFirstCall && system) {
      args.push('--system-prompt', system);
      args.push('--session-id', this.sessionId);
    } else {
      args.push('--resume', this.sessionId);
    }

    return spawnClaude(args, timeout);
  }

  /**
   * Unique session identifier (UUID).
   */
  get id() {
    return this.sessionId;
  }
}

// ── Model resolution ──────────────────────────────────────────────────────────

const MODEL_IDS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
};

function resolveModel(name) {
  return MODEL_IDS[name] || name;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new pipeline session.
 * All calls made through the returned session object share conversation context.
 *
 * @returns {PipelineSession}
 */
export function createPipelineSession() {
  return new PipelineSession(randomUUID());
}

/**
 * One-shot LLM call (no session, no context sharing).
 * Equivalent to the existing callLLM but via direct spawn.
 *
 * @param {string} model
 * @param {string} system
 * @param {string} prompt
 * @param {number} [timeout]
 * @returns {Promise<string>}
 */
export async function callLLMDirect(model, system, prompt, timeout = DEFAULT_TIMEOUT_MS) {
  const args = [
    '-p', prompt,
    '--model', resolveModel(model),
    '--output-format', 'json',
  ];
  if (system) args.push('--system-prompt', system);

  return spawnClaude(args, timeout);
}
