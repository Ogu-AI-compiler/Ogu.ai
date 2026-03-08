/**
 * Gate: severity-labels-valid (PR005)
 * Validates that all alert severity labels use recognised values. An
 * unrecognised severity value causes Alertmanager routing rules to fail to
 * match the alert — the alert fires but is not delivered to any receiver.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_SEVERITIES = ['critical', 'warning', 'info', 'page', 'ticket'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8'));
  const violations = [];

  for (const group of spec.groups) {
    for (const rule of (group.rules || [])) {
      if (!rule.alert) continue;
      const sev = rule.labels?.severity;
      if (sev && !VALID_SEVERITIES.includes(sev)) {
        violations.push({
          alert:    rule.alert,
          received: sev,
          allowed:  VALID_SEVERITIES,
          reason:   `Severity "${sev}" is not a recognised value — Alertmanager routing will not match this alert`,
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'PR005',
      message: `${violations.length} invalid severity label(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'PR005', message: 'All severity labels are valid' };
}
