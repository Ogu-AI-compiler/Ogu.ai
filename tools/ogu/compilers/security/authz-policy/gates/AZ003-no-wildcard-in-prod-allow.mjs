import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ003 — no-wildcard-in-prod-allow: allow rules must not use wildcards for resource or action in production */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.rules)) {
    return { pass: true, code: 'AZ003', message: 'No rules array — gate skipped', skipped: true };
  }

  const WILDCARDS = new Set(['*', 'all', 'any', 'everything']);
  const violations = [];

  for (const rule of spec.rules) {
    const id = rule.id || '?';
    const effect = String(rule.effect || '').toLowerCase();
    if (effect !== 'allow') continue;

    // Escape hatch: rules explicitly documented as intentional wildcards
    if (rule.wildcard_ok === true) continue;

    const resource = String(rule.resource || '');
    const action = String(rule.action || '');

    if (WILDCARDS.has(resource.toLowerCase())) {
      violations.push(`Rule "${id}": allow rule has wildcard resource "${resource}" — specify the exact resource type being granted`);
    }
    if (WILDCARDS.has(action.toLowerCase())) {
      violations.push(`Rule "${id}": allow rule has wildcard action "${action}" — specify the exact action(s) being granted (use an array for multiple)`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ003',
      message: `${violations.length} allow rule(s) use wildcards — narrow the scope`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ003', message: 'No wildcard allow rules found' };
}
