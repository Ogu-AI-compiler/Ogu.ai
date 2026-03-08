/**
 * Grammar Rule Engine — named parsing rules.
 */
export function createGrammarRuleEngine() {
  const rules = new Map();

  function addRule(name, parseFn) {
    rules.set(name, parseFn);
  }

  function parse(ruleName, input) {
    const fn = rules.get(ruleName);
    if (!fn) throw new Error(`rule ${ruleName} not found`);
    return fn(input);
  }

  function listRules() { return [...rules.keys()]; }

  return { addRule, parse, listRules };
}
