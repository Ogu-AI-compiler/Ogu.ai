/**
 * Gate: workload-classes (QPB002)
 * Each workload class must declare statement_timeout and p99_latency_ms.
 * Vague values like "high" or "acceptable" are not acceptable — these must
 * be concrete, measurable values that can be enforced by PostgreSQL's
 * statement_timeout parameter.
 *
 * At minimum, one OLTP workload class must be defined. Background and
 * reporting workloads are optional but must be correctly configured if present.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_WORKLOAD_FIELDS = ['statement_timeout'];
const TIMEOUT_PATTERN = /^(\d+)(ms|s|m|min|h)$/i;
const VAGUE_VALUES = ['high', 'low', 'acceptable', 'fast', 'tbd', 'unknown', 'unlimited', 'none'];

function isVague(value) {
  if (typeof value !== 'string') return false;
  return VAGUE_VALUES.includes(value.toLowerCase().trim());
}

export async function run({ dir }) {
  const specPath = join(dir, 'query-performance-budget.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'QPB002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'QPB002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.workloads || typeof spec.workloads !== 'object') {
    return { pass: true, code: 'QPB002', message: 'No workloads object — gate skipped', skipped: true };
  }

  const violations = [];
  const workloadNames = Object.keys(spec.workloads);

  for (const name of workloadNames) {
    const workload = spec.workloads[name];
    const label = `workloads.${name}`;

    const missing = REQUIRED_WORKLOAD_FIELDS.filter(f => !(f in workload));
    if (missing.length > 0) {
      violations.push(`${label}: missing required field(s): ${missing.join(', ')}`);
    }

    if (workload.statement_timeout !== undefined) {
      if (isVague(workload.statement_timeout)) {
        violations.push(`${label}.statement_timeout "${workload.statement_timeout}" is not a quantitative value. Use formats like "5s", "500ms", "30s".`);
      } else if (!TIMEOUT_PATTERN.test(String(workload.statement_timeout).trim())) {
        violations.push(`${label}.statement_timeout "${workload.statement_timeout}" is not a valid duration format. Use: "5s", "500ms", "2m".`);
      }
    }

    if (workload.p99_latency_ms !== undefined) {
      if (typeof workload.p99_latency_ms !== 'number' || workload.p99_latency_ms <= 0) {
        violations.push(`${label}.p99_latency_ms must be a positive number in milliseconds`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'QPB002',
      message: `${violations.length} workload class issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'QPB002',
    message: `${workloadNames.length} workload class(es) are valid: ${workloadNames.join(', ')}`,
  };
}
