import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ001', message: 'No authz-policy.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'AZ001', message: 'authz-policy.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.feature || typeof spec.feature !== 'string') {
    violations.push('Missing or invalid field: feature');
  }
  if (!Array.isArray(spec.roles) || spec.roles.length === 0) {
    violations.push('Missing or invalid field: roles (must be a non-empty array)');
  }
  if (!Array.isArray(spec.rules) || spec.rules.length === 0) {
    violations.push('Missing or invalid field: rules (must be a non-empty array)');
  }

  if (Array.isArray(spec.rules)) {
    const REQUIRED_RULE_FIELDS = ['id', 'subject', 'resource', 'action', 'effect'];
    spec.rules.forEach((rule, i) => {
      REQUIRED_RULE_FIELDS.forEach(field => {
        if (rule[field] === undefined || rule[field] === null || rule[field] === '') {
          violations.push(`rules[${i}] (id: ${rule.id || '?'}): missing required field "${field}"`);
        }
      });
      if (rule.effect && !['allow', 'deny'].includes(String(rule.effect).toLowerCase())) {
        violations.push(`rules[${i}] (id: ${rule.id || '?'}): effect "${rule.effect}" must be "allow" or "deny"`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ001',
      message: `Spec validation failed: ${violations.length} violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ001', message: `Spec valid — ${spec.rules.length} rule(s) declared` };
}
