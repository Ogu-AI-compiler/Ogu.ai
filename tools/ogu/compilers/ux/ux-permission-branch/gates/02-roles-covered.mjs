/**
 * Gate UPB002 — roles-covered
 * Every role in spec.roles must have at least one corresponding branch entry
 * where branch.roleId matches the role id.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB002',
      message: 'permission-branch-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UPB002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.roles) || !Array.isArray(spec.branches)) {
    return {
      pass: true,
      code: 'UPB002',
      message: 'roles or branches missing — skipped',
      skipped: true,
    };
  }

  // Build set of roleIds covered by branches
  const coveredRoleIds = new Set(
    spec.branches
      .filter(b => typeof b.roleId === 'string')
      .map(b => b.roleId)
  );

  const uncovered = [];
  for (const role of spec.roles) {
    if (typeof role.id !== 'string') continue;
    if (!coveredRoleIds.has(role.id)) {
      uncovered.push(role.id);
    }
  }

  if (uncovered.length > 0) {
    return {
      pass: false,
      code: 'UPB002',
      message: `${uncovered.length} role(s) have no branch defined`,
      detail:
        `Uncovered roles: ${uncovered.join(', ')}\n` +
        'Every role must have at least one branch entry declaring its restrictions.',
    };
  }

  return {
    pass: true,
    code: 'UPB002',
    message: `roles-covered: all ${spec.roles.length} role(s) have at least one branch`,
  };
}
