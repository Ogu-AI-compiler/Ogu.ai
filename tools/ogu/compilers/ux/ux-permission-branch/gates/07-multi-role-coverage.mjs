/**
 * Gate UPB007 — multi-role-coverage
 * If spec.multiRoleResolution is declared, its value must be:
 * "most-restrictive" | "least-restrictive" | "priority-order"
 * If multiple roles can apply to one user, resolution strategy must be defined.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_RESOLUTIONS = new Set(['most-restrictive', 'least-restrictive', 'priority-order']);

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB007',
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
      code: 'UPB007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Gate only applies when multiRoleResolution is declared
  if (!Object.prototype.hasOwnProperty.call(spec, 'multiRoleResolution')) {
    return {
      pass: true,
      code: 'UPB007',
      message: 'multi-role-coverage: multiRoleResolution not declared — gate not applicable',
      skipped: true,
    };
  }

  const resolution = spec.multiRoleResolution;

  if (typeof resolution !== 'string' || !VALID_RESOLUTIONS.has(resolution)) {
    return {
      pass: false,
      code: 'UPB007',
      message: `multiRoleResolution="${resolution}" is invalid`,
      detail:
        `Must be one of: ${[...VALID_RESOLUTIONS].join(', ')}\n` +
        'When a user can have multiple roles simultaneously, the system must know ' +
        'which role wins when restrictions conflict.',
    };
  }

  return {
    pass: true,
    code: 'UPB007',
    message: `multi-role-coverage: multiRoleResolution="${resolution}"`,
  };
}
