/**
 * Budget Role Tracker — track spending per role with alert thresholds.
 */

const DEFAULT_THRESHOLDS = [0.50, 0.75, 0.90];

/**
 * Create a budget role tracker.
 *
 * @param {{ thresholds?: number[] }} opts
 * @returns {object} Tracker with setQuota/record/getByRole/checkAlerts/reset/getAll
 */
export function createBudgetRoleTracker({ thresholds = DEFAULT_THRESHOLDS } = {}) {
  const usage = new Map(); // roleId → { tokensIn, tokensOut, cost, tasks }
  const quotas = new Map(); // roleId → dailyTokens

  function ensureRole(roleId) {
    if (!usage.has(roleId)) {
      usage.set(roleId, { tokensIn: 0, tokensOut: 0, cost: 0, tasks: 0 });
    }
  }

  function setQuota(roleId, dailyTokens) {
    quotas.set(roleId, dailyTokens);
    ensureRole(roleId);
  }

  function record(roleId, { tokensIn = 0, tokensOut = 0, cost = 0 }) {
    ensureRole(roleId);
    const u = usage.get(roleId);
    u.tokensIn += tokensIn;
    u.tokensOut += tokensOut;
    u.cost += cost;
    u.tasks += 1;
  }

  function getByRole(roleId) {
    ensureRole(roleId);
    return { ...usage.get(roleId) };
  }

  function checkAlerts(roleId) {
    const u = usage.get(roleId);
    const quota = quotas.get(roleId);
    if (!u || !quota) return [];

    const totalTokens = u.tokensIn + u.tokensOut;
    const ratio = totalTokens / quota;

    return thresholds
      .filter(t => ratio >= t)
      .map(t => ({
        roleId,
        threshold: t,
        usage: totalTokens,
        quota,
        ratio,
        level: t >= 0.90 ? 'critical' : t >= 0.75 ? 'warning' : 'info',
      }));
  }

  function reset(roleId) {
    usage.set(roleId, { tokensIn: 0, tokensOut: 0, cost: 0, tasks: 0 });
  }

  function getAll() {
    const result = {};
    for (const [roleId, u] of usage) {
      result[roleId] = { ...u, quota: quotas.get(roleId) || null };
    }
    return result;
  }

  return { setQuota, record, getByRole, checkAlerts, reset, getAll };
}
