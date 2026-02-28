/**
 * Load Balancer — distribute work across runners.
 */

export const LB_ALGORITHMS = ['round-robin', 'least-loaded', 'weighted', 'random'];

/**
 * Create a load balancer.
 *
 * @param {{ algorithm?: string }} opts
 * @returns {object} Balancer with addTarget/removeTarget/next/getStats
 */
export function createLoadBalancer({ algorithm = 'round-robin' } = {}) {
  const targets = [];
  let index = 0;
  let totalRequests = 0;

  function addTarget(target) {
    targets.push({ ...target, requestCount: 0 });
  }

  function removeTarget(id) {
    const idx = targets.findIndex(t => t.id === id);
    if (idx !== -1) {
      targets.splice(idx, 1);
      if (index >= targets.length) index = 0;
    }
  }

  function next() {
    if (targets.length === 0) return null;
    const target = targets[index % targets.length];
    target.requestCount++;
    totalRequests++;
    index = (index + 1) % targets.length;
    return target;
  }

  function getStats() {
    return {
      algorithm,
      targetCount: targets.length,
      totalRequests,
      targets: targets.map(t => ({ id: t.id, requestCount: t.requestCount })),
    };
  }

  return { addTarget, removeTarget, next, getStats };
}
