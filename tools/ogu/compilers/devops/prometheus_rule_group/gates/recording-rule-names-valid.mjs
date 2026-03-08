/**
 * Gate: recording-rule-names-valid (PR004)
 * Validates that all recording rule names follow the Prometheus metric naming
 * convention: [a-zA-Z_:][a-zA-Z0-9_:]*. Invalid names are rejected by
 * Prometheus at rule load time with a parse error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8'));
  const violations = [];

  for (const group of spec.groups) {
    for (const rule of (group.rules || [])) {
      if (rule.alert) continue; // alert rule — skip
      if (rule.record && !VALID_METRIC_NAME.test(rule.record)) {
        violations.push({
          record: rule.record,
          reason: `Recording rule name "${rule.record}" does not match [a-zA-Z_:][a-zA-Z0-9_:]* — Prometheus will reject this at load time`,
          hint:   'Use lowercase with underscores (e.g., "job:http_requests:rate5m")',
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'PR004',
      message: `${violations.length} invalid recording rule name(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'PR004', message: 'All recording rule names are valid metric names' };
}
