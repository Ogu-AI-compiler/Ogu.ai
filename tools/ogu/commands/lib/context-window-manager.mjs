/**
 * Context Window Manager — track and manage context window token budget.
 */

/**
 * Create a context window manager.
 *
 * @param {object} opts - { maxTokens }
 * @returns {object} Manager with allocate/release/getRemaining/getBreakdown
 */
export function createContextWindowManager({ maxTokens }) {
  const allocations = new Map();

  function allocate(section, tokens) {
    const current = getAllocated();
    if (current + tokens > maxTokens) {
      return { success: false, remaining: maxTokens - current, requested: tokens };
    }
    allocations.set(section, (allocations.get(section) || 0) + tokens);
    return { success: true, remaining: maxTokens - current - tokens };
  }

  function release(section) {
    allocations.delete(section);
  }

  function getAllocated() {
    let total = 0;
    for (const v of allocations.values()) total += v;
    return total;
  }

  function getRemaining() {
    return maxTokens - getAllocated();
  }

  function getBreakdown() {
    const result = {};
    for (const [k, v] of allocations) result[k] = v;
    return result;
  }

  return { allocate, release, getRemaining, getBreakdown };
}
