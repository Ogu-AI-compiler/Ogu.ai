/**
 * Gate: contract-vault-policy (VP008)
 * Enforces the vault_policy runtime contract: the policy must have a description and
 * an owner for operational accountability, and all roles that use Kubernetes service
 * account auth must specify a namespace (namespace-scoped SA auth is a security
 * boundary — a missing namespace allows any namespace's SA to authenticate).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.description) {
    violations.push({
      rule:   'description-required',
      reason: 'Policy is missing a description — operators cannot determine its purpose without reading every path entry',
      hint:   'Add description: "Grants read access to database credentials for the orders service"',
    });
  }

  if (!spec.owner) {
    violations.push({
      rule:   'owner-required',
      reason: 'Policy is missing an owner — no team is accountable for this access grant',
      hint:   'Add owner: "platform-team" or owner: "orders-service-team"',
    });
  }

  const k8sRoles = spec.roles.filter(r => r.serviceAccount);
  for (const r of k8sRoles) {
    if (!r.namespace) {
      violations.push({
        rule:   'k8s-role-needs-namespace',
        role:   r.name,
        reason: `Role "${r.name}" uses serviceAccount auth but has no namespace — a missing namespace allows any namespace's SA to authenticate`,
        hint:   'Add namespace: "my-service-namespace" to scope the auth binding',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'VP008',
    message: `Vault policy contract satisfied — "${spec.name}", owner: ${spec.owner}`,
  };
}
