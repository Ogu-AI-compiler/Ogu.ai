import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MM008 — contract-monitoring
 * Verifies that model monitoring configuration satisfies the contract:
 * spec exists, drift metric code is present, and alert threshold is numeric.
 *
 * Why:
 * - Monitoring configuration without a spec is undiscoverable: the CI cannot
 *   verify it, orchestrators cannot configure alerts, and the setup cannot
 *   be reviewed or audited.
 * - Drift metric code must be present: declaring a drift_metric in the spec
 *   without implementing it means monitoring exists on paper but not in practice.
 * - Alert threshold must be numeric: a string like "high" is not actionable.
 *   Production alert systems need a concrete number to compare against.
 *
 * Escape hatch: none — these are non-negotiable for production model monitoring.
 */

const RULES = [
  {
    id: 'has-spec',
    description: 'monitoring-spec.json exists',
    test: (_content, dir) => existsSync(join(dir, 'monitoring-spec.json')),
  },
  {
    id: 'has-drift-metric',
    description: 'Drift metric detection code present (PSI, KS test, Evidently, etc.)',
    test: (content, _dir) => /PSI|ks_test|ks_2samp|DataDrift|evidently|drift_metric|wasserstein/.test(content),
  },
  {
    id: 'has-numeric-threshold',
    description: 'alert_threshold is a numeric value in monitoring-spec.json',
    test: (_content, dir) => {
      const specPath = join(dir, 'monitoring-spec.json');
      if (!existsSync(specPath)) return false;
      try {
        const spec = JSON.parse(readFileSync(specPath, 'utf8'));
        return typeof spec.alert_threshold === 'number';
      } catch { return false; }
    },
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.json') || f.endsWith('.yaml'));
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const violations = RULES.filter(r => !r.test(content, dir));

  if (violations.length) {
    return {
      pass: false, code: 'MM008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'MM008', message: 'All monitoring contract rules passed' };
}
