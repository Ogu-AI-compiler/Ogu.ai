/**
 * Gate UPB001 — spec-valid
 * permission-branch-spec.json must exist with:
 * - roles (array) — each role has an id (string)
 * - branches (array) — each branch has roleId (string) and restrictions (array)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB001',
      message: 'permission-branch-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UPB001',
      message: `permission-branch-spec.json parse error: ${err.message}`,
    };
  }

  const missing = [];
  if (!Array.isArray(spec.roles)) missing.push('roles (array)');
  if (!Array.isArray(spec.branches)) missing.push('branches (array)');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UPB001',
      message: `permission-branch-spec.json missing required fields: ${missing.join(', ')}`,
    };
  }

  if (spec.roles.length === 0) {
    return {
      pass: false,
      code: 'UPB001',
      message: 'roles array is empty — at least one role is required',
    };
  }

  if (spec.branches.length === 0) {
    return {
      pass: false,
      code: 'UPB001',
      message: 'branches array is empty — at least one branch is required',
    };
  }

  const violations = [];

  // Validate each role has an id
  spec.roles.forEach((role, i) => {
    if (typeof role.id !== 'string' || role.id.trim() === '') {
      violations.push(`roles[${i}] missing or empty field: id (string)`);
    }
  });

  // Validate each branch has roleId and restrictions array
  spec.branches.forEach((branch, i) => {
    if (typeof branch.roleId !== 'string' || branch.roleId.trim() === '') {
      violations.push(`branches[${i}] missing or empty field: roleId (string)`);
    }
    if (!Array.isArray(branch.restrictions)) {
      violations.push(`branches[${i}](roleId="${branch.roleId ?? 'unknown'}") missing field: restrictions (array)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB001',
      message: `${violations.length} structural violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB001',
    message: `spec-valid: ${spec.roles.length} role(s), ${spec.branches.length} branch(es)`,
  };
}
