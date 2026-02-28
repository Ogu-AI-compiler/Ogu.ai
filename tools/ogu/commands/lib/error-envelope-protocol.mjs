/**
 * Error Envelope Protocol — structured error envelope with OGU codes and recovery.
 */

import { randomUUID } from 'node:crypto';

export const RECOVERY_ACTIONS = ['retry', 'escalate', 'abort', 'skip', 'manual'];

const ERROR_REQUIRED = ['taskId', 'agentId', 'error', 'code', 'recoverable'];

/**
 * Create an error envelope.
 */
export function createErrorEnvelope({ taskId, agentId, error, code, recoverable, suggestedAction = 'manual' }) {
  return {
    envelopeId: randomUUID().slice(0, 12),
    type: 'error',
    taskId,
    agentId,
    error,
    code,
    recoverable,
    suggestedAction,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an escalation envelope.
 */
export function createEscalationEnvelope({ taskId, fromRole, toRole, reason, context = {} }) {
  return {
    envelopeId: randomUUID().slice(0, 12),
    type: 'escalation',
    taskId,
    fromRole,
    toRole,
    reason,
    context,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate an error envelope.
 */
export function validateErrorEnvelope(envelope) {
  const errors = [];
  for (const field of ERROR_REQUIRED) {
    if (envelope[field] === undefined || envelope[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
