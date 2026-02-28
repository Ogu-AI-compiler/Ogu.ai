import { randomUUID } from 'node:crypto';

/**
 * Studio Event Envelope — sequenced, typed events for Studio SSE transport.
 *
 * Every event has a monotonic seq, streamKey, priority, and snapshotHash.
 * Supports event coalescing for backpressure management.
 */

let _seq = 0;

/**
 * Event priority levels.
 */
export const EVENT_PRIORITIES = {
  critical: { level: 0, description: 'Always delivered immediately, bypasses coalescing' },
  high: { level: 1, description: 'Delivered with minimal delay' },
  normal: { level: 2, description: 'Standard delivery, subject to coalescing' },
  low: { level: 3, description: 'Best-effort delivery, coalesced aggressively' },
};

/**
 * Create a Studio event envelope.
 *
 * @param {object} opts
 * @param {string} opts.type - Event type (e.g., 'budget.updated', 'task.completed')
 * @param {string} opts.streamKey - Stream partition key (e.g., 'budget', 'tasks', 'audit')
 * @param {object} opts.payload - Event data
 * @param {string} [opts.priority] - 'critical' | 'high' | 'normal' | 'low'
 * @param {string} [opts.snapshotHash] - Hash of current state snapshot
 * @returns {{ id, seq, type, streamKey, payload, priority, snapshotHash, timestamp }}
 */
export function createEventEnvelope({ type, streamKey, payload, priority, snapshotHash } = {}) {
  _seq++;

  return {
    id: randomUUID(),
    seq: _seq,
    type,
    streamKey: streamKey || 'default',
    payload: payload || {},
    priority: priority || 'normal',
    snapshotHash: snapshotHash || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Coalesce events within the same stream and type.
 *
 * Keeps only the latest event per (streamKey, type) pair.
 * Critical events are never coalesced.
 *
 * @param {Array} events
 * @returns {Array} Coalesced events
 */
export function coalesceEvents(events) {
  const critical = [];
  const latest = new Map();

  for (const event of events) {
    if (event.priority === 'critical') {
      critical.push(event);
      continue;
    }

    const key = `${event.streamKey}::${event.type}`;
    latest.set(key, event);
  }

  const result = [...critical, ...latest.values()];
  result.sort((a, b) => a.seq - b.seq);
  return result;
}

/**
 * Serialize an event envelope for SSE transport.
 *
 * @param {object} envelope
 * @returns {string} SSE-formatted string
 */
export function serializeForSSE(envelope) {
  const lines = [
    `event: ${envelope.type}`,
    `id: ${envelope.id}`,
    `data: ${JSON.stringify(envelope)}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Reset the sequence counter (for testing).
 */
export function resetSeq() {
  _seq = 0;
}
