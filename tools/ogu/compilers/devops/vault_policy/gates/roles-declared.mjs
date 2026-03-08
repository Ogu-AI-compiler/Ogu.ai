/**
 * Gate: roles-declared (VP006)
 * Validates that every role entry is properly bound to an auth method. A role with
 * no binding (no serviceAccount, tokenPolicy, or appRole) is an orphan — it can
 * never be used, and its presence in the spec is misleading.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const violations = [];

  for (const role of spec.roles) {
    if (!role.name) {
      violations.push({ entry: JSON.stringify(role), reason: 'role entry missing name field' });
      continue;
    }
    if (!role.serviceAccount && !role.tokenPolicy && !role.appRole) {
      violations.push({
        role:   role.name,
        reason: 'role has no auth binding — it cannot be used without serviceAccount, tokenPolicy, or appRole',
        hint:   'Add: serviceAccount: { name: "my-app", namespace: "default" } or appRole: { roleId: "..." }',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP006',
      message: `${violations.length} role declaration issue(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'VP006',
    message: `All ${spec.roles.length} roles are properly declared with auth bindings`,
  };
}
