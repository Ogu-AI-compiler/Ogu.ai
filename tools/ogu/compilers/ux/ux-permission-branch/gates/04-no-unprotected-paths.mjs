/**
 * Gate UPB004 — no-unprotected-paths
 * If spec has `protectedActions` array, every action must appear in at least
 * one branch restriction. Actions not covered by any branch are treated as
 * fully open (violation).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB004',
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
      code: 'UPB004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Gate only applies when protectedActions is declared
  if (!Array.isArray(spec.protectedActions)) {
    return {
      pass: true,
      code: 'UPB004',
      message: 'no-unprotected-paths: protectedActions not declared — gate not applicable',
      skipped: true,
    };
  }

  if (spec.protectedActions.length === 0) {
    return {
      pass: true,
      code: 'UPB004',
      message: 'no-unprotected-paths: protectedActions is empty — gate not applicable',
      skipped: true,
    };
  }

  // Build set of all targetIds covered by any branch restriction
  const coveredTargetIds = new Set();
  if (Array.isArray(spec.branches)) {
    for (const branch of spec.branches) {
      if (!Array.isArray(branch.restrictions)) continue;
      for (const restriction of branch.restrictions) {
        if (typeof restriction.targetId === 'string') {
          coveredTargetIds.add(restriction.targetId);
        }
      }
    }
  }

  const violations = [];

  for (const action of spec.protectedActions) {
    // Each protected action can be a string id or an object with id
    const actionId = typeof action === 'string' ? action : action?.id;
    if (typeof actionId !== 'string') continue;

    if (!coveredTargetIds.has(actionId)) {
      violations.push(
        `protectedAction "${actionId}" is not covered by any branch restriction — ` +
        'this action is effectively open to all roles'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB004',
      message: `${violations.length} protected action(s) have no branch restriction`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB004',
    message: `no-unprotected-paths: all ${spec.protectedActions.length} protected action(s) covered`,
  };
}
