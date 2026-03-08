/**
 * Event Replay — replay missed events from a given seq number.
 */

/**
 * Create an event replay buffer.
 *
 * @param {{ maxSize: number }} opts
 * @returns {object} Buffer with append/replaySince/size
 */
export function createEventReplayBuffer({ maxSize = 10000 }) {
  const buffer = [];

  function append(event) {
    buffer.push(event);
    // Evict oldest when over capacity
    while (buffer.length > maxSize) {
      buffer.shift();
    }
  }

  function replaySince(lastSeq) {
    return buffer.filter(e => e.seq > lastSeq);
  }

  function size() {
    return buffer.length;
  }

  function getLatestSeq() {
    if (buffer.length === 0) return 0;
    return buffer[buffer.length - 1].seq;
  }

  return { append, replaySince, size, getLatestSeq };
}
