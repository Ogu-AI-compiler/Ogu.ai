/**
 * Stream Cursor — seq-based recovery for SSE reconnection.
 *
 * Tracks per-stream cursor positions so clients can reconnect
 * and receive only missed events.
 */

/**
 * Create a cursor store for tracking stream positions.
 *
 * @returns {{ setCursor, getCursor, getAllCursors }}
 */
export function createCursorStore() {
  const cursors = {};

  return {
    /**
     * Set cursor position for a stream.
     */
    setCursor(streamKey, seq) {
      cursors[streamKey] = seq;
    },

    /**
     * Get cursor position for a stream (defaults to 0).
     */
    getCursor(streamKey) {
      return cursors[streamKey] || 0;
    },

    /**
     * Get all cursor positions.
     */
    getAllCursors() {
      return { ...cursors };
    },
  };
}

/**
 * Get events missed since a cursor position.
 *
 * @param {Array} allEvents - All available events
 * @param {string} streamKey - Stream to filter by
 * @param {number} lastSeq - Last seen sequence number
 * @returns {Array} Missed events for the stream
 */
export function getMissedEvents(allEvents, streamKey, lastSeq) {
  return allEvents.filter(e =>
    e.streamKey === streamKey && e.seq > lastSeq
  );
}
