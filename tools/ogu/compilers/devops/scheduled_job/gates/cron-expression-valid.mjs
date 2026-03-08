/**
 * Gate: cron-expression-valid (SJ002)
 * Validates the cron schedule expression field-by-field. An invalid expression
 * causes the CronJob controller to reject the resource at admission time with
 * a cryptic "invalid schedule" error. This gate surfaces the specific field
 * that is out of range or malformed so it can be fixed before deployment.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Valid Kubernetes/Unix cron shorthands
const SHORTHANDS = new Set([
  '@yearly', '@annually', '@monthly', '@weekly',
  '@daily', '@midnight', '@hourly', '@reboot',
]);

// Per-field valid ranges and special characters
// Fields: minute hour dom month dow
const FIELD_RANGES = [
  { name: 'minute',       min: 0,  max: 59  },
  { name: 'hour',         min: 0,  max: 23  },
  { name: 'day-of-month', min: 1,  max: 31  },
  { name: 'month',        min: 1,  max: 12  },
  { name: 'day-of-week',  min: 0,  max: 7   }, // 0 and 7 both = Sunday
];

function validateField(value, range) {
  // Wildcard
  if (value === '*') return null;

  // Step values: */N or range/N
  if (value.includes('/')) {
    const [base, step] = value.split('/');
    if (!/^\d+$/.test(step) || parseInt(step) < 1) {
      return `step value "${step}" must be a positive integer`;
    }
    if (base !== '*') {
      const err = validateField(base, range);
      if (err) return err;
    }
    return null;
  }

  // List: a,b,c
  if (value.includes(',')) {
    for (const part of value.split(',')) {
      const err = validateField(part.trim(), range);
      if (err) return `in list "${value}": ${err}`;
    }
    return null;
  }

  // Range: a-b
  if (value.includes('-')) {
    const [lo, hi] = value.split('-').map(Number);
    if (isNaN(lo) || isNaN(hi)) return `range "${value}" must use integers`;
    if (lo < range.min || lo > range.max) return `${lo} out of valid range ${range.min}-${range.max}`;
    if (hi < range.min || hi > range.max) return `${hi} out of valid range ${range.min}-${range.max}`;
    if (lo > hi) return `range "${value}" is inverted (low > high)`;
    return null;
  }

  // Plain integer
  if (!/^\d+$/.test(value)) return `"${value}" is not a valid integer or expression`;
  const n = parseInt(value);
  if (n < range.min || n > range.max) return `${n} out of valid range ${range.min}-${range.max}`;
  return null;
}

function validateCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return `cron expression must have exactly 5 fields (minute hour dom month dow), got ${parts.length}`;
  }
  for (let i = 0; i < 5; i++) {
    const err = validateField(parts[i], FIELD_RANGES[i]);
    if (err) return `${FIELD_RANGES[i].name} field "${parts[i]}": ${err}`;
  }
  return null;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));

  if (!spec.schedule) {
    return {
      pass: false, code: 'SJ002',
      message: 'schedule field is required',
      detail: { hint: 'Use a 5-field cron expression (e.g. "0 2 * * *") or a shorthand like @daily' },
    };
  }

  const s = spec.schedule.trim();

  if (s.startsWith('@')) {
    if (!SHORTHANDS.has(s)) {
      return {
        pass: false, code: 'SJ002',
        message: `Unknown cron shorthand: "${s}"`,
        detail: { received: s, validShorthands: [...SHORTHANDS] },
      };
    }
    return { pass: true, code: 'SJ002', message: `Cron shorthand valid: ${s}` };
  }

  const err = validateCron(s);
  if (err) {
    return {
      pass: false, code: 'SJ002',
      message: `Invalid cron expression: ${err}`,
      detail: { expression: s, hint: 'Fields: minute (0-59) hour (0-23) day-of-month (1-31) month (1-12) day-of-week (0-7)' },
    };
  }

  return { pass: true, code: 'SJ002', message: `Cron expression valid: ${s}` };
}
