/**
 * Scheduling Policy Router — select scheduling policy based on context.
 */

export const SCHEDULING_POLICIES = ['fifo', 'wfq', 'priority', 'round-robin', 'deadline'];

/**
 * Create a scheduling router.
 *
 * @returns {object} Router with addPolicy/selectPolicy/setDefault/listPolicies
 */
export function createSchedulingRouter() {
  const policies = []; // { name, match, scheduler }
  let defaultPolicy = { name: 'fifo', scheduler: () => 'fifo' };

  function addPolicy(name, { match, scheduler }) {
    policies.push({ name, match, scheduler });
  }

  function listPolicies() {
    return policies.map(p => p.name);
  }

  function setDefault(name, scheduler) {
    defaultPolicy = { name, scheduler };
  }

  function selectPolicy(context) {
    for (const policy of policies) {
      if (policy.match(context)) {
        return { name: policy.name, scheduler: policy.scheduler };
      }
    }
    return defaultPolicy;
  }

  return { addPolicy, selectPolicy, setDefault, listPolicies };
}
