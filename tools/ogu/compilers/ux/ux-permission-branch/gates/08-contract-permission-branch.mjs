/**
 * Gate UPB008 — contract-permission-branch
 * Final contract check:
 * - version declared
 * - unique role ids
 * - each restriction has targetId and type
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB008',
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
      code: 'UPB008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.roles) || !Array.isArray(spec.branches)) {
    return {
      pass: true,
      code: 'UPB008',
      message: 'roles or branches missing — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: permission-branch-spec.json missing field "version"');
  }

  // Rule: unique role ids
  const seenRoleIds = new Map();
  for (const role of spec.roles) {
    if (typeof role.id !== 'string') continue;
    if (seenRoleIds.has(role.id)) {
      violations.push(`Contract: Duplicate role id "${role.id}"`);
    } else {
      seenRoleIds.set(role.id, true);
    }
  }

  // Rule: each restriction has targetId and type
  for (const branch of spec.branches) {
    if (!Array.isArray(branch.restrictions)) continue;
    branch.restrictions.forEach((restriction, i) => {
      const label = `branch(roleId="${branch.roleId ?? 'unknown'}").restrictions[${i}]`;
      if (typeof restriction.targetId !== 'string' || restriction.targetId.trim() === '') {
        violations.push(`Contract: ${label} missing or empty field: targetId (string)`);
      }
      if (typeof restriction.type !== 'string' || restriction.type.trim() === '') {
        violations.push(`Contract: ${label} missing or empty field: type (string)`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB008',
    message: 'contract-permission-branch: all contract rules satisfied',
  };
}
