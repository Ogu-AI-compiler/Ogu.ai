/**
 * Code Formatter — format code strings with configurable rules.
 */
export function createCodeFormatter(options = {}) {
  const indent = options.indent || '  ';
  const maxLineLength = options.maxLineLength || 80;
  const rules = [];
  function addRule(name, transform) { rules.push({ name, transform }); }
  function format(code) {
    let result = code;
    for (const rule of rules) result = rule.transform(result);
    return result;
  }
  function formatLines(code) {
    return code.split('\n').map(line => line.trimEnd()).join('\n');
  }
  function getIndent() { return indent; }
  function listRules() { return rules.map(r => r.name); }
  return { addRule, format, formatLines, getIndent, listRules };
}
