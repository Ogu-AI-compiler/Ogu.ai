/**
 * State Transition — rule-based state transition table.
 */
export function createStateTransition() {
  const rules = [];
  const ruleMap = new Map();
  function addRule(from, event, to) {
    rules.push({ from, event, to });
    ruleMap.set(`${from}:${event}`, to);
  }
  function getNextState(from, event) {
    return ruleMap.get(`${from}:${event}`) || null;
  }
  function listRules() { return [...rules]; }
  return { addRule, getNextState, listRules };
}
