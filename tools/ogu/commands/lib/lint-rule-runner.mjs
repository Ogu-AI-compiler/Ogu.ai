/**
 * Lint Rule Runner — run lint rules against code.
 */
export function createLintRuleRunner() {
  const rules = [];
  function addRule(name, severity, check) {
    rules.push({ name, severity, check });
  }
  function run(code) {
    const issues = [];
    for (const rule of rules) {
      const results = rule.check(code);
      if (results && results.length > 0) {
        for (const r of results) {
          issues.push({ rule: rule.name, severity: rule.severity, ...r });
        }
      }
    }
    return issues;
  }
  function removeRule(name) {
    const idx = rules.findIndex(r => r.name === name);
    if (idx >= 0) rules.splice(idx, 1);
  }
  function listRules() { return rules.map(r => ({ name: r.name, severity: r.severity })); }
  return { addRule, run, removeRule, listRules };
}
