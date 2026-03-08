/**
 * Gate: alert-names-unique (PR002)
 * Validates that no two alert rules share the same name. Duplicate alert names
 * in Prometheus cause the second rule to silently overwrite the first, meaning
 * one of the conditions is never actually evaluated or fired.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8'));
  const alertNames = spec.groups.flatMap(g => (g.rules || []).filter(r => r.alert).map(r => r.alert));

  const seen       = new Map();
  const violations = [];

  for (const name of alertNames) {
    if (seen.has(name)) {
      if (!violations.find(v => v.alert === name)) {
        violations.push({ alert: name, reason: `Duplicate alert name "${name}" — the second definition silently overwrites the first` });
      }
    } else {
      seen.set(name, true);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'PR002',
      message: `${violations.length} duplicate alert name(s) found`,
      detail: { violations, hint: 'Each alert name must be unique across all rule groups' },
    };
  }

  return { pass: true, code: 'PR002', message: `All ${alertNames.length} alert names are unique` };
}
