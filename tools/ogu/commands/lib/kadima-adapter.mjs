/**
 * Kadima Adapter — strict boundary enforcement between Kadima and Ogu.
 *
 * ALL communication between Kadima and Ogu MUST pass through this adapter.
 * No direct function calls across the boundary.
 *
 * Inbound:  Kadima → Ogu via dispatch(inputEnvelope)
 * Outbound: Ogu → Kadima via respond(outputEnvelope)
 *
 * Also provides legacy LLM provider formatting for backwards compatibility.
 */

import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ── Legacy Provider Adapter (backwards compat) ─────────────────────────

export const PROVIDER_DEFAULTS = {
  anthropic: { model: 'claude-sonnet-4-6', maxTokens: 4096, format: 'anthropic' },
  openai: { model: 'gpt-4o', maxTokens: 4096, format: 'openai' },
  local: { model: 'local', maxTokens: 2048, format: 'openai' },
};

export function formatTaskForProvider({ taskId, title, role, provider, context, model, maxTokens } = {}) {
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.anthropic;
  return {
    taskId,
    provider,
    model: model || defaults.model,
    maxTokens: maxTokens || defaults.maxTokens,
    system: buildSystemPrompt(role, context),
    messages: [{ role: 'user', content: buildUserMessage(title, context) }],
  };
}

export function parseProviderResponse({ provider, raw } = {}) {
  if (provider === 'anthropic') {
    return {
      text: raw?.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || '',
      tokens: { input: raw?.usage?.input_tokens || 0, output: raw?.usage?.output_tokens || 0 },
      finishReason: raw?.stop_reason || 'unknown',
    };
  }
  if (provider === 'openai') {
    return {
      text: raw?.choices?.[0]?.message?.content || '',
      tokens: { input: raw?.usage?.prompt_tokens || 0, output: raw?.usage?.completion_tokens || 0 },
      finishReason: raw?.choices?.[0]?.finish_reason || 'unknown',
    };
  }
  return {
    text: typeof raw === 'string' ? raw : JSON.stringify(raw),
    tokens: { input: 0, output: 0 },
    finishReason: 'unknown',
  };
}

export function createNotificationPayload({ event, taskId, featureSlug, result } = {}) {
  return { event, taskId, featureSlug, timestamp: new Date().toISOString(), payload: result || {} };
}

// ── Strict Boundary Adapter ─────────────────────────────────────────────

/**
 * THE ONLY WAY Kadima can talk to Ogu.
 * Every dispatch goes through validation pipeline.
 *
 * @param {string} root - Repo root
 * @param {object} inputEnvelope - Kadima input envelope
 * @returns {{ accepted: boolean, error?: object, policyEffects?: object }}
 */
export async function dispatch(root, inputEnvelope) {
  root = root || repoRoot();

  // Step 1: Schema validation
  const schemaResult = validateInputEnvelope(inputEnvelope);
  if (!schemaResult.valid) {
    return errorResponse('OGU4001', `Invalid InputEnvelope: ${schemaResult.errors.join(', ')}`);
  }

  // Step 2: Agent identity check (lazy — only if agentId provided)
  if (inputEnvelope.agentId) {
    try {
      const { verifyCredential } = await import('./agent-identity.mjs');
      const identityResult = verifyCredential(root, inputEnvelope.agentId, inputEnvelope.agentSignature);
      if (!identityResult.valid) {
        return errorResponse('OGU4002', `Agent identity invalid: ${identityResult.error}`);
      }
    } catch { /* Agent identity module not available — skip */ }
  }

  // Step 3: Feature envelope check (lazy)
  if (inputEnvelope.featureSlug) {
    try {
      const { checkEnvelope } = await import('./feature-isolation.mjs');
      const envelopeResult = checkEnvelope(root, inputEnvelope.featureSlug, {
        taskCost: inputEnvelope.estimatedCost || 0,
        resourceType: inputEnvelope.resourceType || 'model_call',
        filesTouch: (inputEnvelope.expectedOutputs || []).map(o => o.path).filter(Boolean),
      });
      if (!envelopeResult.allowed) {
        return errorResponse('OGU4003', envelopeResult.violations.map(v => v.error).join('; '));
      }
    } catch { /* Feature isolation module not available — skip */ }
  }

  // Step 4: Audit the dispatch
  emitAudit('kadima.dispatch', {
    taskId: inputEnvelope.taskId,
    featureSlug: inputEnvelope.featureSlug,
    agentId: inputEnvelope.agentId,
  }, { kadima: true });

  return {
    accepted: true,
    envelope: inputEnvelope,
    dispatchedAt: new Date().toISOString(),
  };
}

/**
 * THE ONLY WAY Ogu can respond to Kadima.
 */
export async function respond(root, outputEnvelope) {
  root = root || repoRoot();

  const schemaResult = validateOutputEnvelope(outputEnvelope);
  if (!schemaResult.valid) {
    emitAudit('kadima.invalid_output', {
      errors: schemaResult.errors,
    }, { kadima: true });
    return errorResponse('OGU4006', `Invalid OutputEnvelope: ${schemaResult.errors.join(', ')}`);
  }

  // Record cost against feature envelope
  if (outputEnvelope.cost?.totalCost && outputEnvelope.featureSlug) {
    try {
      const { recordSpend } = await import('./feature-isolation.mjs');
      recordSpend(root, outputEnvelope.featureSlug, outputEnvelope.cost.totalCost);
    } catch { /* skip */ }
  }

  emitAudit('kadima.response', {
    taskId: outputEnvelope.taskId,
    status: outputEnvelope.status,
    cost: outputEnvelope.cost?.totalCost,
  }, { kadima: true });

  return { accepted: true, envelope: outputEnvelope };
}

// ── Validation ──────────────────────────────────────────────────────────

function validateInputEnvelope(envelope) {
  const errors = [];
  if (!envelope) { errors.push('envelope is null'); return { valid: false, errors }; }
  if (!envelope.taskId) errors.push('taskId required');
  if (!envelope.featureSlug && !envelope.type) errors.push('featureSlug or type required');
  return { valid: errors.length === 0, errors };
}

function validateOutputEnvelope(envelope) {
  const errors = [];
  if (!envelope) { errors.push('envelope is null'); return { valid: false, errors }; }
  if (!envelope.taskId && !envelope.type) errors.push('taskId or type required');
  return { valid: errors.length === 0, errors };
}

function errorResponse(code, message) {
  return {
    accepted: false,
    error: { code, message, timestamp: new Date().toISOString() },
  };
}

// ── Boundary Enforcement Rules ──────────────────────────────────────────

/**
 * Static analysis rules for enforcing the adapter boundary.
 * Used by `ogu validate` to detect direct cross-boundary imports.
 */
export const BOUNDARY_RULES = [
  {
    check: 'kadima_imports_ogu',
    pattern: /from ['"].*tools\/ogu\/commands\//,
    inFiles: 'tools/kadima/**/*.mjs',
    allowed: ['kadima-adapter.mjs'],
    error: 'OGU4010: Kadima module imports Ogu directly. Use kadima-adapter.dispatch() instead.',
  },
  {
    check: 'ogu_imports_kadima',
    pattern: /from ['"].*tools\/kadima\//,
    inFiles: 'tools/ogu/**/*.mjs',
    allowed: [],
    error: 'OGU4011: Ogu module imports Kadima directly. Return OutputEnvelope instead.',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function buildSystemPrompt(role, context) {
  const parts = [`You are a ${role} agent working on a software project.`];
  if (context?.featureSlug) parts.push(`Current feature: ${context.featureSlug}`);
  if (context?.spec) parts.push(`Specification:\n${context.spec}`);
  return parts.join('\n\n');
}

function buildUserMessage(title, context) {
  const parts = [`Task: ${title}`];
  if (context?.files) {
    parts.push(`Relevant files: ${Array.isArray(context.files) ? context.files.join(', ') : context.files}`);
  }
  return parts.join('\n\n');
}
