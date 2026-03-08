/**
 * Resource Pool — manage pooled resources (connections, threads).
 */

/**
 * Create a resource pool.
 *
 * @param {{ maxSize: number, factory: () => object }} opts
 * @returns {object} Pool with acquire/release/getStats
 */
export function createResourcePool({ maxSize, factory }) {
  const available = [];
  let inUse = 0;

  function acquire() {
    if (available.length > 0) {
      inUse++;
      return available.pop();
    }
    if (inUse >= maxSize) return null;
    inUse++;
    return factory();
  }

  function release(resource) {
    inUse--;
    available.push(resource);
  }

  function getStats() {
    return {
      maxSize,
      inUse,
      available: available.length,
      total: inUse + available.length,
    };
  }

  return { acquire, release, getStats };
}
