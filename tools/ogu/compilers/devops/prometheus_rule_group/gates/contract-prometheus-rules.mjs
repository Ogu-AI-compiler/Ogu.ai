/**
 * Gate: contract-prometheus-rules (PR007)
 * Validates that the prometheus rules satisfy the contract: at least one alert
 * must be defined (unless recordingOnly: true), and every alert must link to
 * a runbook so on-call engineers know what to do when the alert fires.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8'));
  const allAlerts  = spec.groups.flatMap(g => (g.rules || []).filter(r => r.alert));
  const violations = [];

  if (allAlerts.length === 0 && !spec.recordingOnly) {
    violations.push({
      rule:   'alerts-required',
      reason: 'No alert rules defined — at least one alert is required for monitoring to be meaningful',
      hint:   'Add at least one alert rule, or set recordingOnly: true if this group contains only recording rules',
    });
  }

  const noRunbook = allAlerts.filter(r => !r.annotations?.runbook_url && !r.annotations?.runbook);
  if (noRunbook.length > 0) {
    violations.push({
      rule:   'runbook-required',
      alerts: noRunbook.map(r => r.alert),
      reason: `${noRunbook.length} alert(s) missing a runbook_url or runbook annotation — on-call engineers will not know what to do`,
      hint:   'Add annotations.runbook_url: "https://..." linking to the runbook for each alert',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'PR007',
      message: `${violations.length} contract violation(s) in prometheus-rules-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'PR007', message: `Prometheus rules contract satisfied — ${allAlerts.length} alert(s)` };
}
