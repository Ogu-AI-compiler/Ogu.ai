/**
 * Canary — graduated rollout with traffic routing and metrics.
 */

import { createHash } from 'node:crypto';

/**
 * Create a canary deployment manager.
 *
 * @param {{ name: string, percentage: number }} opts
 * @returns {object} Canary with route/recordResult/metrics/promote/rollback/getStatus
 */
export function createCanary({ name, percentage = 10 }) {
  let pct = percentage;
  let state = 'active';
  const results = { canary: { total: 0, success: 0 }, stable: { total: 0, success: 0 } };

  function route(requestId) {
    // Deterministic routing based on hash of requestId
    const hash = createHash('md5').update(requestId).digest();
    const value = hash[0]; // 0-255
    return (value / 255) * 100 < pct ? 'canary' : 'stable';
  }

  function recordResult(target, success) {
    if (target === 'canary') {
      results.canary.total++;
      if (success) results.canary.success++;
    } else {
      results.stable.total++;
      if (success) results.stable.success++;
    }
  }

  function metrics() {
    return { ...results };
  }

  function promote() {
    pct = 100;
    state = 'promoted';
  }

  function rollback() {
    pct = 0;
    state = 'rolled_back';
  }

  function getStatus() {
    return { name, percentage: pct, state };
  }

  return { route, recordResult, metrics, promote, rollback, getStatus };
}
