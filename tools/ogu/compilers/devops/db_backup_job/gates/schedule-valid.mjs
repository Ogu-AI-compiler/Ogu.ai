/**
 * Gate: schedule-valid (DBB002)
 * Validates the backup cron schedule expression. Also enforces at least daily
 * backup frequency — infrequent backups may not meet RTO/RPO requirements.
 * Use skipFrequencyCheck: true if a longer interval is intentional.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SHORTHANDS = new Set([
  '@yearly', '@annually', '@monthly', '@weekly',
  '@daily', '@midnight', '@hourly',
]);

const FIELD_RANGES = [
  { name: 'minute',       min: 0, max: 59 },
  { name: 'hour',         min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month',        min: 1, max: 12 },
  { name: 'day-of-week',  min: 0, max: 7  },
];

function validateField(value, range) {
  if (value === '*') return null;
  if (value.includes('/')) {
    const [base, step] = value.split('/');
    if (!/^\d+$/.test(step) || parseInt(step) < 1)
      return `step "${step}" must be a positive integer`;
    return base !== '*' ? validateField(base, range) : null;
  }
  if (value.includes(',')) {
    for (const part of value.split(',')) {
      const err = validateField(part.trim(), range);
      if (err) return `in list "${value}": ${err}`;
    }
    return null;
  }
  if (value.includes('-')) {
    const [lo, hi] = value.split('-').map(Number);
    if (isNaN(lo) || isNaN(hi)) return `range "${value}" must use integers`;
    if (lo < range.min || lo > range.max) return `${lo} out of ${range.min}-${range.max}`;
    if (hi < range.min || hi > range.max) return `${hi} out of ${range.min}-${range.max}`;
    if (lo > hi) return `range "${value}" is inverted`;
    return null;
  }
  if (!/^\d+$/.test(value)) return `"${value}" is not a valid integer or expression`;
  const n = parseInt(value);
  if (n < range.min || n > range.max) return `${n} out of valid range ${range.min}-${range.max}`;
  return null;
}

function validateCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5)
    return `must have 5 fields (minute hour dom month dow), got ${parts.length}`;
  for (let i = 0; i < 5; i++) {
    const err = validateField(parts[i], FIELD_RANGES[i]);
    if (err) return `${FIELD_RANGES[i].name} field "${parts[i]}": ${err}`;
  }
  return null;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'db-backup-spec.json'), 'utf8'));

  if (!spec.schedule) {
    return {
      pass: false, code: 'DBB002',
      message: 'schedule field is required for backup job',
      detail: { hint: 'Use a 5-field cron expression (e.g. "0 2 * * *" for 2am daily) or a shorthand like @daily' },
    };
  }

  const s = spec.schedule.trim();

  if (s.startsWith('@')) {
    if (!SHORTHANDS.has(s)) {
      return {
        pass: false, code: 'DBB002',
        message: `Unknown cron shorthand: "${s}"`,
        detail: { received: s, validShorthands: [...SHORTHANDS] },
      };
    }
    return { pass: true, code: 'DBB002', message: `Backup schedule valid: ${s}` };
  }

  const err = validateCron(s);
  if (err) {
    return {
      pass: false, code: 'DBB002',
      message: `Invalid backup schedule: ${err}`,
      detail: { expression: s, hint: 'Fields: minute (0-59) hour (0-23) day-of-month (1-31) month (1-12) day-of-week (0-7)' },
    };
  }

  // Enforce at least daily frequency — backups less frequent than once a day are operationally risky
  const hourField  = s.split(/\s+/)[1];
  const isAtLeastDaily = hourField === '*' || hourField.startsWith('*/');
  if (!isAtLeastDaily && !spec.skipFrequencyCheck) {
    return {
      pass: false, code: 'DBB002',
      message: `Backup frequency appears less than daily (hour field: "${hourField}")`,
      detail: {
        expression:        s,
        hourField,
        reason:            'Infrequent backups may not meet RTO/RPO requirements',
        hint:              'Set skipFrequencyCheck: true with a documented justification if a longer interval is intentional',
      },
    };
  }

  return { pass: true, code: 'DBB002', message: `Backup schedule valid: ${s}` };
}
