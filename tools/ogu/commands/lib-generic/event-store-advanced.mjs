/**
 * Event Store Advanced — append-only event store with stream support.
 */
export function createEventStoreAdvanced() {
  const events = [];
  const streams = new Map();
  function append(stream, event) {
    const entry = { stream, event, seq: events.length, timestamp: Date.now() };
    events.push(entry);
    if (!streams.has(stream)) streams.set(stream, []);
    streams.get(stream).push(entry);
    return entry.seq;
  }
  function getStream(stream) { return [...(streams.get(stream) || [])]; }
  function getAll() { return [...events]; }
  function getAfter(seq) { return events.filter(e => e.seq > seq); }
  function listStreams() { return [...streams.keys()]; }
  function count() { return events.length; }
  return { append, getStream, getAll, getAfter, listStreams, count };
}
