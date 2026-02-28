/**
 * Backpressure Manager — event coalescing with critical bypass.
 *
 * Buffers events and coalesces same-type events within a window.
 * Critical events always pass through without coalescing.
 */

/**
 * Create a backpressure manager.
 *
 * @param {object} opts
 * @param {number} opts.windowMs - Coalescing window in milliseconds
 * @returns {{ enqueue, flush, bufferSize }}
 */
export function createBackpressureManager({ windowMs } = {}) {
  const buffer = [];

  return {
    /**
     * Add an event to the buffer.
     */
    enqueue(event) {
      buffer.push({
        ...event,
        _bufferedAt: Date.now(),
      });
    },

    /**
     * Flush the buffer, coalescing events.
     *
     * Same (streamKey, type) events are coalesced — only the latest is kept.
     * Critical events are never coalesced.
     *
     * @returns {Array} Coalesced events
     */
    flush() {
      const critical = [];
      const latest = new Map();

      for (const event of buffer) {
        if (event.priority === 'critical') {
          critical.push(event);
          continue;
        }

        const key = `${event.streamKey}::${event.type}`;
        latest.set(key, event);
      }

      // Clear buffer
      buffer.length = 0;

      const result = [...critical, ...latest.values()];
      return result;
    },

    /**
     * Get current buffer size.
     */
    bufferSize() {
      return buffer.length;
    },
  };
}
