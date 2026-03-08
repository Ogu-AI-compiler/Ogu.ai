/**
 * Policy Evaluator — evaluate policies with full trigger support.
 */

/**
 * Create a policy evaluator.
 *
 * @returns {object} Evaluator with addPolicy/evaluate/listPolicies
 */
export function createPolicyEvaluator() {
  const policies = []; // { id, trigger, effect, priority, conditions }

  function addPolicy({ id, trigger, effect, priority = 0, conditions = {} }) {
    policies.push({ id, trigger, effect, priority, conditions });
  }

  function listPolicies() {
    return [...policies];
  }

  function evaluate({ type, ...context }) {
    // Find matching policies (same trigger type)
    const matching = policies
      .filter(p => p.trigger === type)
      .sort((a, b) => b.priority - a.priority); // highest priority first

    if (matching.length === 0) {
      return { effect: 'allow', matchedPolicy: null, reason: 'no matching policies' };
    }

    const winner = matching[0];
    return {
      effect: winner.effect,
      matchedPolicy: winner.id,
      priority: winner.priority,
      trigger: type,
      context,
    };
  }

  function removePolicy(id) {
    const idx = policies.findIndex(p => p.id === id);
    if (idx !== -1) policies.splice(idx, 1);
  }

  return { addPolicy, evaluate, listPolicies, removePolicy };
}
