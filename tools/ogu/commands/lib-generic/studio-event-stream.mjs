/**
 * Studio Event Stream — formal SSE-style event stream with sequence tracking.
 *
 * Provides pub/sub with monotonic sequence numbers and replay from any point.
 */

/**
 * Create an event stream.
 *
 * @returns {object} Stream with publish/subscribe/getSequence/getHistory
 */
export function createEventStream() {
  let seq = 0;
  const events = [];
  const subscribers = new Set();

  function publish({ type, data }) {
    seq++;
    const event = {
      seq,
      type,
      data,
      timestamp: Date.now(),
    };
    events.push(event);
    for (const cb of subscribers) {
      cb(event);
    }
    return event;
  }

  function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  function getSequence() {
    return seq;
  }

  function getHistory(sinceSeq = 0) {
    return events.filter(e => e.seq > sinceSeq);
  }

  return { publish, subscribe, getSequence, getHistory };
}
