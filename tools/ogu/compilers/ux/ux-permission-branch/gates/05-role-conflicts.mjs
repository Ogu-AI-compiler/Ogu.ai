/**
 * Gate UPB005 — role-conflicts
 * No two branch restrictions may target the same `targetId` with contradictory
 * types for the same roleId (e.g., both "hide" and "show" for the same role and target).
 * Contradictory pairs: hide↔show, enable↔disable
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Pairs of mutually exclusive restriction types
const CONFLICT_PAIRS = [
  new Set(['hide', 'show']),
  new Set(['enable', 'disable']),
];

function areConflicting(typeA, typeB) {
  for (const pair of CONFLICT_PAIRS) {
    if (pair.has(typeA) && pair.has(typeB) && typeA !== typeB) {
      return true;
    }
  }
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB005',
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
      code: 'UPB005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.branches)) {
    return {
      pass: true,
      code: 'UPB005',
      message: 'No branches array — skipped',
      skipped: true,
    };
  }

  // Build a map: roleId → targetId → [types]
  // Key is "${roleId}::${targetId}"
  const roleTargetTypes = new Map();

  for (const branch of spec.branches) {
    if (typeof branch.roleId !== 'string') continue;
    if (!Array.isArray(branch.restrictions)) continue;

    for (const restriction of branch.restrictions) {
      if (typeof restriction.targetId !== 'string') continue;
      if (typeof restriction.type !== 'string') continue;

      const key = `${branch.roleId}::${restriction.targetId}`;
      if (!roleTargetTypes.has(key)) {
        roleTargetTypes.set(key, []);
      }
      roleTargetTypes.get(key).push(restriction.type);
    }
  }

  const violations = [];

  for (const [key, types] of roleTargetTypes.entries()) {
    // Check every pair within the collected types for this role+target
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        if (areConflicting(types[i], types[j])) {
          const [roleId, targetId] = key.split('::');
          violations.push(
            `Conflict: roleId="${roleId}", targetId="${targetId}" has both ` +
            `type="${types[i]}" and type="${types[j]}" — these are mutually exclusive`
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB005',
      message: `${violations.length} restriction conflict(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB005',
    message: 'role-conflicts: no contradictory restriction types detected',
  };
}
