/**
 * Gate: alerts-have-required-fields (PR003)
 * Validates that every alert rule declares: an expr (the PromQL condition),
 * a labels.severity (for routing to the right alert channel), and an
 * annotations.summary (for the on-call engineer to understand what fired).
 * Alerts missing these fields are functionally incomplete.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8'));
  const violations = [];

  for (const group of spec.groups) {
    for (const rule of (group.rules || [])) {
      if (!rule.alert) continue; // recording rule — skip
      if (!rule.expr)                violations.push({ alert: rule.alert, field: 'expr',               reason: 'Missing PromQL expression — alert will never evaluate' });
      if (!rule.labels?.severity)    violations.push({ alert: rule.alert, field: 'labels.severity',    reason: 'Missing severity label — alert cannot be routed to the correct channel' });
      if (!rule.annotations?.summary) violations.push({ alert: rule.alert, field: 'annotations.summary', reason: 'Missing summary annotation — on-call engineer cannot understand what fired' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'PR003',
      message: `${violations.length} alert field(s) missing across alert rules`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'PR003', message: 'All alerts have required fields (expr, severity, summary)' };
}
