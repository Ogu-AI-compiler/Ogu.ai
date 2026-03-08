/**
 * Garbage Collector — mark-sweep unused resources.
 */

let nextId = 1;

export function createGC() {
  const resources = new Map();
  const marked = new Set();
  let totalCollected = 0;
  let sweepCount = 0;

  function allocate(meta) {
    const id = `gc-${nextId++}`;
    resources.set(id, { id, meta, allocatedAt: Date.now() });
    return id;
  }

  function mark(id) {
    marked.add(id);
  }

  function sweep() {
    let collected = 0;
    for (const id of resources.keys()) {
      if (!marked.has(id)) {
        resources.delete(id);
        collected++;
      }
    }
    marked.clear();
    totalCollected += collected;
    sweepCount++;
    return collected;
  }

  function getStats() {
    return {
      allocated: resources.size,
      totalCollected,
      sweepCount,
    };
  }

  return { allocate, mark, sweep, getStats };
}
