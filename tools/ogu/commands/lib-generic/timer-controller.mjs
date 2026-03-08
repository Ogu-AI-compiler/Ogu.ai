/**
 * Timer Controller — create, cancel, and tick hardware timers.
 */
export function createTimerController() {
  const timers = new Map();
  function createTimer(id, interval, callback) {
    timers.set(id, { interval, callback, counter: 0, active: true });
  }
  function cancel(id) { timers.delete(id); }
  function tick() {
    for (const [id, t] of timers) {
      if (!t.active) continue;
      t.counter++;
      if (t.counter >= t.interval) {
        t.callback();
        t.counter = 0;
      }
    }
  }
  function list() { return [...timers.keys()]; }
  return { createTimer, cancel, tick, list };
}
