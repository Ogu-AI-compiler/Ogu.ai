/**
 * WFQ Integration — wire weighted fair queuing into task scheduling.
 */

/**
 * Create a WFQ integration.
 *
 * @returns {object} Integration with addClass/submit/next/getStats/listClasses
 */
export function createWFQIntegration() {
  const classes = new Map(); // name → { weight, queue: [], virtualTime }

  function addClass(name, { weight = 1 }) {
    classes.set(name, { name, weight, queue: [], virtualTime: 0 });
  }

  function listClasses() {
    return Array.from(classes.keys());
  }

  function submit(taskId, className) {
    const cls = classes.get(className);
    if (!cls) throw new Error(`Unknown class: ${className}`);
    cls.queue.push(taskId);
  }

  function next() {
    // Pick the class with lowest virtualTime that has pending tasks
    let best = null;
    let bestTime = Infinity;

    for (const cls of classes.values()) {
      if (cls.queue.length > 0 && cls.virtualTime < bestTime) {
        best = cls;
        bestTime = cls.virtualTime;
      }
    }

    if (!best) return null;

    const task = best.queue.shift();
    // Increment virtual time inversely proportional to weight
    best.virtualTime += 1 / best.weight;
    return task;
  }

  function getStats() {
    let totalPending = 0;
    const byClass = {};
    for (const cls of classes.values()) {
      totalPending += cls.queue.length;
      byClass[cls.name] = { pending: cls.queue.length, weight: cls.weight, virtualTime: cls.virtualTime };
    }
    return { totalPending, byClass };
  }

  return { addClass, submit, next, getStats, listClasses };
}
