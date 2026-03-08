/**
 * Rule Engine — evaluate and execute conditional rules.
 */

export function createRuleEngine() {
  const rules = [];

  function addRule({ name, condition, action }) {
    rules.push({ name, condition, action });
  }

  function evaluate(context) {
    const fired = [];
    for (const rule of rules) {
      if (rule.condition(context)) {
        rule.action(context);
        fired.push(rule.name);
      }
    }
    return { fired };
  }

  function listRules() {
    return rules.map(r => r.name);
  }

  return { addRule, evaluate, listRules };
}
