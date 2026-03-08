/**
 * Alert Rules Engine — threshold-based alerting with configurable severity.
 */

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'];

const CONDITIONS = {
  gte: (v, t) => v >= t,
  gt:  (v, t) => v > t,
  lte: (v, t) => v <= t,
  lt:  (v, t) => v < t,
  eq:  (v, t) => v === t,
  neq: (v, t) => v !== t,
};

/**
 * Create an alert engine instance.
 * @returns {object} Engine with addRule/evaluate/listRules
 */
export function createAlertEngine() {
  const rules = [];

  function addRule(rule) {
    rules.push(rule);
  }

  function listRules() {
    return [...rules];
  }

  function evaluate(metrics) {
    const alerts = [];

    for (const rule of rules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;

      const check = CONDITIONS[rule.condition];
      if (!check) continue;

      if (check(value, rule.threshold)) {
        alerts.push({
          ruleId: rule.id,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          severity: rule.severity || 'warning',
          message: (rule.message || '').replace('{value}', String(value)),
          timestamp: Date.now(),
        });
      }
    }

    return alerts;
  }

  return { addRule, evaluate, listRules };
}
