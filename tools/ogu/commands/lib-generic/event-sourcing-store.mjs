/**
 * Event Sourcing Store — append-only event log with replay.
 */

export function createEventStore() {
  const events = [];
  let sequence = 0;

  function append(event) {
    sequence++;
    const entry = { ...event, sequence, timestamp: Date.now() };
    events.push(entry);
    return entry;
  }

  function getEvents({ fromSequence } = {}) {
    if (fromSequence !== undefined) {
      return events.filter(e => e.sequence >= fromSequence);
    }
    return [...events];
  }

  function replay(reducer, initial) {
    return events.reduce((acc, e) => reducer(acc, e), initial);
  }

  return { append, getEvents, replay };
}
