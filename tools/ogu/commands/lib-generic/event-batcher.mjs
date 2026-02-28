/**
 * Event Batcher — batch and coalesce events for efficient transport.
 */

/**
 * Create an event batcher.
 *
 * @param {{ batchIntervalMs: number, criticalTypes?: string[], coalesceTypes?: string[], onCritical?: function }} opts
 * @returns {object} Batcher with push/flush/getPendingCount
 */
export function createEventBatcher({ batchIntervalMs = 100, criticalTypes = [], coalesceTypes = [], onCritical } = {}) {
  let buffer = [];
  const criticalSet = new Set(criticalTypes);
  const coalesceSet = new Set(coalesceTypes);

  function push(event) {
    // Critical events bypass batching
    if (criticalSet.has(event.type)) {
      if (onCritical) onCritical(event);
      return;
    }
    buffer.push(event);
  }

  function flush() {
    // Coalesce: keep only the last event per coalesced type
    const coalesced = [];
    const lastByType = new Map();

    for (const event of buffer) {
      if (coalesceSet.has(event.type)) {
        lastByType.set(event.type, event);
      } else {
        coalesced.push(event);
      }
    }

    // Add coalesced events
    for (const event of lastByType.values()) {
      coalesced.push(event);
    }

    buffer = [];
    return coalesced;
  }

  function getPendingCount() {
    return buffer.length;
  }

  return { push, flush, getPendingCount, batchIntervalMs };
}
