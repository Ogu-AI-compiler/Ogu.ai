/**
 * Gate: contract-helm-chart (HC008)
 * Validates that helm-chart-spec.json satisfies the Helm chart contract:
 * charts must declare a maintainers list (for ownership accountability) and
 * a description (for discoverability in chart repositories).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'helm-chart-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.maintainers || !Array.isArray(spec.maintainers) || spec.maintainers.length === 0) {
    violations.push({ rule: 'maintainers-required', reason: 'Chart has no maintainers list — ownership cannot be determined', hint: 'Add maintainers: [{ name, email }] to the spec' });
  }
  if (!spec.description || spec.description.trim() === '') {
    violations.push({ rule: 'description-required', reason: 'Chart has no description — not discoverable in chart repositories', hint: 'Add a description field summarizing what this chart deploys' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'HC008',
      message: `${violations.length} contract violation(s) in helm-chart-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'HC008', message: 'Helm chart contract satisfied' };
}
