/**
 * Envelope Protocol — Input/Output/Error envelopes for agent communication.
 * Supports chaining (inReplyTo), context validation, authority checks, and sealing.
 */
import { randomUUID, createHash } from 'node:crypto';

const INPUT_REQUIRED = ['taskId', 'agentId', 'feature', 'phase', 'context'];
const OUTPUT_REQUIRED = ['taskId', 'agentId', 'result', 'artifacts', 'metrics'];
const ERROR_REQUIRED = ['taskId', 'agentId', 'error', 'code', 'severity'];
const VALID_SEVERITIES = ['info', 'warn', 'error', 'critical'];

/** Create an input envelope for agent invocation. */
export function createInputEnvelope({ taskId, agentId, feature, phase, context = {} }) {
  return {
    envelopeId: randomUUID().slice(0, 12),
    type: 'input',
    taskId,
    agentId,
    feature,
    phase,
    context,
    timestamp: new Date().toISOString(),
  };
}

/** Create an output envelope for agent completion. */
export function createOutputEnvelope({ taskId, agentId, result, artifacts = [], metrics = {} }) {
  return {
    envelopeId: randomUUID().slice(0, 12),
    type: 'output',
    taskId,
    agentId,
    result,
    artifacts,
    metrics,
    timestamp: new Date().toISOString(),
  };
}

/** Validate an input envelope. */
export function validateInputEnvelope(envelope) {
  const errors = [];
  for (const field of INPUT_REQUIRED) {
    if (envelope[field] === undefined || envelope[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate an output envelope. */
export function validateOutputEnvelope(envelope) {
  const errors = [];
  for (const field of OUTPUT_REQUIRED) {
    if (envelope[field] === undefined || envelope[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Create an error envelope with OGU error code, severity, and recovery flag.
 * Severity must be one of: info, warn, error, critical.
 */
export function createErrorEnvelope({ taskId, agentId, error, code, severity, recoverable = false }) {
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    throw new Error(`Invalid severity "${severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  return {
    envelopeId: randomUUID().slice(0, 12),
    type: 'error',
    taskId,
    agentId,
    error,
    code,
    severity,
    recoverable,
    timestamp: new Date().toISOString(),
  };
}

/** Validate an error envelope has all required fields and valid severity. */
export function validateErrorEnvelope(envelope) {
  const errors = [];
  for (const field of ERROR_REQUIRED) {
    if (envelope[field] === undefined || envelope[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (envelope.severity && !VALID_SEVERITIES.includes(envelope.severity)) {
    errors.push(`Invalid severity "${envelope.severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  if (envelope.type !== undefined && envelope.type !== 'error') {
    errors.push(`Expected type "error", got "${envelope.type}"`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Chain a new envelope to a parent via `inReplyTo`.
 * Enables replay-chain tracking — every child records which envelope it responds to.
 */
export function chainEnvelope(parentEnvelope, childData) {
  if (!parentEnvelope || !parentEnvelope.envelopeId) {
    throw new Error('Parent envelope must have an envelopeId');
  }
  return {
    envelopeId: randomUUID().slice(0, 12),
    inReplyTo: parentEnvelope.envelopeId,
    timestamp: new Date().toISOString(),
    ...childData,
  };
}

/**
 * Validate that an envelope's context matches expected state.
 * Compare feature slug, phase, specHash, or any other context keys.
 * @returns {{ valid: boolean, mismatches: string[] }}
 */
export function validateContext(envelope, expectedContext) {
  const mismatches = [];
  if (!envelope || !envelope.context) {
    return { valid: false, mismatches: ['Envelope has no context'] };
  }
  for (const [key, expected] of Object.entries(expectedContext)) {
    const actual = envelope.context[key];
    if (actual !== expected) {
      mismatches.push(`context.${key}: expected "${expected}", got "${actual === undefined ? 'undefined' : actual}"`);
    }
  }
  return { valid: mismatches.length === 0, mismatches };
}

/**
 * Check whether the agent in the envelope has authority for an action.
 * OrgSpec must contain a `roles` map: { [agentId]: { role, permissions } }.
 * requiredRole can be a string or array of acceptable roles.
 * @returns {{ authorized: boolean, reason: string }}
 */
export function checkAuthority(envelope, requiredRole, orgSpec) {
  if (!envelope || !envelope.agentId) {
    return { authorized: false, reason: 'Envelope missing agentId' };
  }
  if (!orgSpec || !orgSpec.roles) {
    return { authorized: false, reason: 'OrgSpec missing roles map' };
  }
  const agentEntry = orgSpec.roles[envelope.agentId];
  if (!agentEntry) {
    return { authorized: false, reason: `Agent "${envelope.agentId}" not found in OrgSpec` };
  }
  const acceptable = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (acceptable.includes(agentEntry.role)) {
    return { authorized: true, reason: 'Role matches' };
  }
  return {
    authorized: false,
    reason: `Agent role "${agentEntry.role}" does not match required: ${acceptable.join(', ')}`,
  };
}

/** Compute canonical JSON for hashing (excludes `seal`, keys sorted). */
function canonicalize(envelope) {
  const clone = { ...envelope };
  delete clone.seal;
  const sorted = {};
  for (const k of Object.keys(clone).sort()) sorted[k] = clone[k];
  return JSON.stringify(sorted);
}

/** Seal an envelope with SHA-256 to detect tampering. Returns new object. */
export function sealEnvelope(envelope) {
  if (!envelope || !envelope.envelopeId) {
    throw new Error('Cannot seal an envelope without envelopeId');
  }
  const hash = createHash('sha256').update(canonicalize(envelope)).digest('hex');
  return { ...envelope, seal: hash };
}

/** Verify that the seal on an envelope is still valid. */
export function verifySeal(envelope) {
  if (!envelope || !envelope.seal) {
    return { valid: false, reason: 'Envelope has no seal' };
  }
  const expected = createHash('sha256').update(canonicalize(envelope)).digest('hex');
  if (envelope.seal === expected) {
    return { valid: true, reason: 'Seal matches' };
  }
  return { valid: false, reason: 'Seal mismatch — envelope may have been tampered with' };
}
