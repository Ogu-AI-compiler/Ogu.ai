/**
 * Sliding Window Counter — count events in a sliding time window.
 */
export function createSlidingWindowCounter(windowMs) {
  const events = [];
  function add(timestamp = Date.now()) {
    events.push(timestamp);
  }
  function count(now = Date.now()) {
    return events.filter(t => now - t < windowMs).length;
  }
  function prune(now = Date.now()) {
    let i = 0;
    while (i < events.length && now - events[i] >= windowMs) i++;
    events.splice(0, i);
  }
  function getAll() { return [...events]; }
  function reset() { events.length = 0; }
  return { add, count, prune, getAll, reset };
}
