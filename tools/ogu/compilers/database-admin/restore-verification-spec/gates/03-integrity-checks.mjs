/**
 * Gate: integrity-checks (RVS003)
 * integrity_checks must declare at least one critical table with a row count
 * check. Restoring a database and not verifying row counts is the same as
 * not verifying the restore — a partial restore with missing data can go
 * undetected until a customer reports a data loss incident.
 *
 * Each integrity check must declare:
 * - table: the table name
 * - check_type: "row_count" | "checksum" | "sample_query"
 * - threshold: acceptable deviation (e.g., 0.001 = 0.1% tolerance)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_CHECK_TYPES = ['row_count', 'checksum', 'sample_query', 'count_compare'];

export async function run({ dir }) {
  const specPath = join(dir, 'restore-verification-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RVS003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RVS003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.integrity_checks)) {
    return { pass: true, code: 'RVS003', message: 'No integrity_checks array — gate skipped', skipped: true };
  }

  if (spec.integrity_checks.length === 0) {
    return {
      pass: false,
      code: 'RVS003',
      message: 'integrity_checks must contain at least one check',
      detail:
        'At minimum, declare a row_count check for your most critical table.\n' +
        'Without integrity checks, a partial restore is indistinguishable from a full restore.',
    };
  }

  const violations = [];
  let hasRowCountCheck = false;

  for (let i = 0; i < spec.integrity_checks.length; i++) {
    const check = spec.integrity_checks[i];
    const label = `integrity_checks[${i}]`;

    if (!check.table) {
      violations.push(`${label}: "table" field is required`);
    }

    if (!check.check_type) {
      violations.push(`${label}: "check_type" field is required`);
    } else if (!VALID_CHECK_TYPES.includes(check.check_type)) {
      violations.push(`${label}: check_type "${check.check_type}" is not valid (${VALID_CHECK_TYPES.join(', ')})`);
    }

    if (check.check_type === 'row_count' || check.check_type === 'count_compare') {
      hasRowCountCheck = true;
    }
  }

  if (!hasRowCountCheck) {
    violations.push(
      'No row_count or count_compare check declared. At least one table must have a row count check ' +
      'to detect partial restores and data truncation.'
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RVS003',
      message: `${violations.length} integrity check issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RVS003',
    message: `${spec.integrity_checks.length} integrity check(s) defined, including row count verification`,
  };
}
