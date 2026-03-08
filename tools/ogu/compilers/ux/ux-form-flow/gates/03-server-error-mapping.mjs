/**
 * Gate UFF003 — server-error-mapping
 * If spec has `serverErrors` array, every entry must have:
 * - code (string)
 * - userMessage (string)
 * If spec.serverErrors is absent, this gate is skipped (optional feature).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF003',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Gate only applies when serverErrors is present
  if (!Array.isArray(spec.serverErrors)) {
    return {
      pass: true,
      code: 'UFF003',
      message: 'server-error-mapping: serverErrors not declared — gate not applicable',
      skipped: true,
    };
  }

  if (spec.serverErrors.length === 0) {
    return {
      pass: false,
      code: 'UFF003',
      message: 'serverErrors array is declared but empty — either populate it or remove it',
    };
  }

  const violations = [];

  spec.serverErrors.forEach((entry, i) => {
    const label = `serverErrors[${i}]`;
    if (typeof entry.code !== 'string' || entry.code.trim() === '') {
      violations.push(`${label} missing or empty field: code (string)`);
    }
    if (typeof entry.userMessage !== 'string' || entry.userMessage.trim() === '') {
      violations.push(`${label} missing or empty field: userMessage (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UFF003',
      message: `${violations.length} serverError entry/entries missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UFF003',
    message: `server-error-mapping: ${spec.serverErrors.length} server error(s) with code and userMessage`,
  };
}
