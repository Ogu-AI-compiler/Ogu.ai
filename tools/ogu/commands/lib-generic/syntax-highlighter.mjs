/**
 * Syntax Highlighter — tokenize and highlight source code.
 */
export function createSyntaxHighlighter() {
  const rules = [];
  function addRule(name, pattern) { rules.push({ name, pattern: new RegExp(pattern, 'g') }); }
  function highlight(code) {
    const tokens = [];
    for (const rule of rules) {
      let match;
      rule.pattern.lastIndex = 0;
      while ((match = rule.pattern.exec(code)) !== null) {
        tokens.push({ type: rule.name, value: match[0], start: match.index, end: match.index + match[0].length });
      }
    }
    tokens.sort((a, b) => a.start - b.start);
    return tokens;
  }
  function listRules() { return rules.map(r => r.name); }
  return { addRule, highlight, listRules };
}
