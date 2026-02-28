/**
 * Decision Table — condition-action rule matching.
 */
export function createDecisionTable(defaultAction = null) {
  const rules = [];
  function addRule(conditions, action) { rules.push({ conditions, action }); }
  function evaluate(input) {
    for (const rule of rules) {
      let match = true;
      for (const [key, value] of Object.entries(rule.conditions)) {
        if (value !== 'any' && input[key] !== value) { match = false; break; }
      }
      if (match) return rule.action;
    }
    return defaultAction;
  }
  function listRules() { return [...rules]; }
  return { addRule, evaluate, listRules };
}
