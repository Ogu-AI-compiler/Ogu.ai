import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ002 — default-deny-exists: policy must include an explicit default deny rule */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.rules)) {
    return { pass: true, code: 'AZ002', message: 'No rules array — gate skipped', skipped: true };
  }

  // Check for an explicit default deny at the top-level or as a rule
  const hasTopLevelDefaultDeny = spec.default_effect === 'deny' || spec.default_deny === true;

  // Or a rule with wildcard subject/resource/action and effect: deny
  const hasDefaultDenyRule = spec.rules.some(rule => {
    const subject = String(rule.subject || '');
    const resource = String(rule.resource || '');
    const action = String(rule.action || '');
    const effect = String(rule.effect || '').toLowerCase();
    const isWildcard = (v) => v === '*' || v === 'all' || v.toLowerCase() === 'any';
    return effect === 'deny' && isWildcard(subject) && isWildcard(resource) && isWildcard(action);
  });

  if (!hasTopLevelDefaultDeny && !hasDefaultDenyRule) {
    return {
      pass: false,
      code: 'AZ002',
      message: 'Policy has no explicit default deny — add default_effect: "deny" at the top level, or a wildcard deny rule',
      detail: 'Authorization policies must be deny-by-default. Any access not explicitly allowed must be denied.\nAdd: "default_effect": "deny" to the top-level policy object.',
    };
  }

  return { pass: true, code: 'AZ002', message: 'Default deny is explicitly declared' };
}
