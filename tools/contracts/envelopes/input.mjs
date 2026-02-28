import { randomUUID } from 'crypto';
import { InputEnvelopeSchema } from '../schemas/input-envelope.mjs';

/**
 * Build a validated InputEnvelope.
 * Kadima calls this before dispatching a task to a Runner.
 *
 * @param {object} params - Envelope fields
 * @returns {import('../schemas/input-envelope.mjs').InputEnvelope}
 * @throws {z.ZodError} if validation fails
 */
export function buildInputEnvelope(params) {
  const envelope = {
    version: 1,
    taskId: params.taskId,
    featureSlug: params.featureSlug,
    taskName: params.taskName,
    agent: {
      roleId: params.agent.roleId,
      sessionId: params.agent.sessionId || randomUUID(),
      capabilities: params.agent.capabilities || [],
    },
    prompt: params.prompt,
    files: params.files || [],
    routingDecision: params.routingDecision,
    budget: params.budget,
    sandboxPolicy: params.sandboxPolicy || {
      allowedPaths: [],
      blockedPaths: [],
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      blockedTools: [],
      envFilter: [],
      networkAccess: 'none',
      networkAllowlist: [],
    },
    blastRadius: params.blastRadius || {
      allowed_write: [],
      allowed_delete: [],
      max_files_changed: 50,
      max_lines_changed: 5000,
    },
    isolationLevel: params.isolationLevel || 'L0',
    mergeStrategy: params.mergeStrategy || 'auto',
    relevantHistory: params.relevantHistory || { entities: [], ragTokens: 0 },
    temperature: params.temperature ?? 0,
    validationRules: params.validationRules || {},
    policyResults: params.policyResults || [],
    createdAt: new Date().toISOString(),
    idempotencyKey: params.idempotencyKey || `${params.taskId}-${Date.now()}`,
  };

  // Validate against schema — throws if invalid
  return InputEnvelopeSchema.parse(envelope);
}
