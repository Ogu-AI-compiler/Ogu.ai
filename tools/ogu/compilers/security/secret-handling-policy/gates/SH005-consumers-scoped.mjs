import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH005 — consumers-scoped: every secret must declare its allowed consumers */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH005', message: 'No secrets array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const secret of spec.secrets) {
    const id = secret.id || '?';

    if (!Array.isArray(secret.allowed_consumers)) {
      violations.push(`Secret "${id}": allowed_consumers must be an array`);
      continue;
    }

    if (secret.allowed_consumers.length === 0) {
      violations.push(`Secret "${id}": allowed_consumers is empty — at least one consuming service must be declared`);
      continue;
    }

    // Reject wildcard consumers — secrets must be scoped to specific service identities
    for (const consumer of secret.allowed_consumers) {
      if (consumer === '*' || consumer === 'all' || consumer === 'everyone') {
        violations.push(`Secret "${id}": wildcard consumer "${consumer}" is not allowed — list specific service identities`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH005',
      message: `${violations.length} secret(s) have missing or wildcard consumer scope`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH005', message: `Consumer scope defined for all ${spec.secrets.length} secret(s)` };
}
