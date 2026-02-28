/**
 * Studio Event Envelope — typed envelope for Studio WebSocket events.
 */

import { randomUUID } from 'node:crypto';

export const STUDIO_EVENT_TYPES = [
  'TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED',
  'BUDGET_TICK', 'GOV_BLOCKED', 'GOV_APPROVED',
  'SNAPSHOT_AVAILABLE', 'INTENT_STATE',
  'AGENT_STARTED', 'AGENT_STOPPED',
  'VM_STDOUT', 'VM_STDERR',
  'LOCK_ACQUIRED', 'LOCK_RELEASED',
];

export const CRITICAL_EVENTS = ['GOV_BLOCKED', 'INTENT_STATE', 'SNAPSHOT_AVAILABLE'];

let globalSeq = 0;

/**
 * Create a typed Studio event.
 */
export function createStudioEvent({ type, streamKey, payload, correlationId, causationId, priority }) {
  globalSeq++;
  return {
    eventId: randomUUID().slice(0, 12),
    type,
    schemaVersion: 1,
    streamKey: streamKey || 'global',
    seq: globalSeq,
    correlationId: correlationId || null,
    causationId: causationId || null,
    priority: priority || (CRITICAL_EVENTS.includes(type) ? 'critical' : 'normal'),
    payload,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if event type is critical (bypasses batching).
 */
export function isCriticalEvent(type) {
  return CRITICAL_EVENTS.includes(type);
}
