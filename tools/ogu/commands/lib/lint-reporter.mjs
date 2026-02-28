/**
 * Lint Reporter — format and report lint results.
 */
export function createLintReporter() {
  function formatText(issues) {
    return issues.map(i => `[${i.severity}] ${i.rule}: ${i.message || ''} (line ${i.line || '?'})`).join('\n');
  }
  function formatJSON(issues) { return JSON.stringify(issues, null, 2); }
  function summary(issues) {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    return { total: issues.length, errors, warnings };
  }
  function hasErrors(issues) { return issues.some(i => i.severity === 'error'); }
  return { formatText, formatJSON, summary, hasErrors };
}
