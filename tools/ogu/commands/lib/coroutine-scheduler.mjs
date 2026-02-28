/**
 * Coroutine Scheduler — cooperative scheduling of generator-based coroutines.
 */
export function createCoroutineScheduler() {
  const queue = [];

  function schedule(genFn) {
    queue.push(genFn());
  }

  function runAll() {
    const active = [...queue];
    queue.length = 0;
    while (active.length > 0) {
      const gen = active.shift();
      const result = gen.next();
      if (!result.done) active.push(gen);
    }
  }

  function getStats() {
    return { pending: queue.length };
  }

  return { schedule, runAll, getStats };
}
