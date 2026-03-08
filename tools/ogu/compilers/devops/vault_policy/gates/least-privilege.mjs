/**
 * Gate: least-privilege (VP005)
 * Enforces the least-privilege principle on vault policy paths: sudo capability
 * requires a written justification (it grants root-like access), and deny must
 * not be mixed with other capabilities (the combination is semantically meaningless
 * and indicates the policy author is confused about how deny works in Vault).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8'));
  const violations = [];

  for (const p of spec.paths) {
    const caps = new Set(p.capabilities || []);

    if (caps.has('sudo') && !p.justification) {
      violations.push({
        path:   p.path,
        rule:   'sudo-requires-justification',
        reason: 'sudo grants root-level Vault access — must document why it is necessary',
        hint:   'Add justification: "Required to renew PKI certificates — Vault admin team approval #1234"',
      });
    }

    if (caps.has('deny') && caps.size > 1) {
      violations.push({
        path:   p.path,
        rule:   'deny-must-be-sole-capability',
        reason: 'deny mixed with other capabilities — in Vault, deny overrides all other caps, making the others meaningless',
        hint:   'Use only ["deny"] when blocking a path, or remove deny and use only the desired capabilities',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'VP005',
      message: `${violations.length} least-privilege violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'VP005',
    message: 'Capability assignments follow the least-privilege principle',
  };
}
