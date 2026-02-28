import { randomUUID } from 'node:crypto';

/**
 * Error Envelope — structured error format for Kadima ↔ Ogu contract.
 *
 * Every error flowing between services uses this envelope:
 *   - Unique ID
 *   - OGU error code
 *   - Severity level
 *   - Source component
 *   - Context (taskId, featureSlug)
 *   - Timestamp
 */

const RECOVERABLE_CODES = new Set([
  'OGU0601', // Budget — might free up
  'OGU0602', // Timeout — retry
  'OGU0605', // Conflict — wait and retry
  'OGU0606', // Transient — retry
]);

/**
 * Create a structured error envelope.
 */
export function createErrorEnvelope({ code, message, source, severity = 'error', taskId, featureSlug, details } = {}) {
  return {
    id: randomUUID(),
    type: 'error',
    code,
    message,
    source,
    severity,
    taskId: taskId || null,
    featureSlug: featureSlug || null,
    details: details || null,
    timestamp: new Date().toISOString(),
    recoverable: RECOVERABLE_CODES.has(code),
  };
}

/**
 * Create an escalation record from an error.
 */
export function createEscalation({ errorEnvelope, from, to, reason } = {}) {
  return {
    id: randomUUID(),
    type: 'escalation',
    errorId: errorEnvelope?.id || null,
    errorCode: errorEnvelope?.code || null,
    from,
    to,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

/**
 * Check if an error code is recoverable (can be retried).
 */
export function isRecoverable(code) {
  return RECOVERABLE_CODES.has(code);
}

/**
 * Serialize an envelope to JSON string.
 */
export function serializeEnvelope(envelope) {
  return JSON.stringify(envelope);
}

/**
 * Parse an envelope from JSON string.
 */
export function parseEnvelope(json) {
  return JSON.parse(json);
}
