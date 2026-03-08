/**
 * Compliance Checker — check data/actions against compliance rules.
 */
export function createComplianceChecker() {
  const rules = [];
  function addRule(name, check) {
    rules.push({ name, check });
  }
  function validate(data) {
    const violations = [];
    for (const rule of rules) {
      if (!rule.check(data)) violations.push(rule.name);
    }
    return { valid: violations.length === 0, violations };
  }
  function listRules() { return rules.map(r => r.name); }
  function removeRule(name) {
    const idx = rules.findIndex(r => r.name === name);
    if (idx >= 0) rules.splice(idx, 1);
  }
  return { addRule, validate, listRules, removeRule };
}
