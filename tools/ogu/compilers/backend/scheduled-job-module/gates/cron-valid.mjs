import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * SJ002 — cron-valid
 * Validate cron expression syntax (5 or 6 fields).
 * Validates without external deps using field-by-field range check.
 */

function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return `Expected 5-6 fields, got ${parts.length}`;

  const ranges = parts.length === 6
    ? [
        { name: 'second',     min: 0,  max: 59 },
        { name: 'minute',     min: 0,  max: 59 },
        { name: 'hour',       min: 0,  max: 23 },
        { name: 'day-of-month', min: 1, max: 31 },
        { name: 'month',      min: 1,  max: 12 },
        { name: 'day-of-week', min: 0, max: 7 },
      ]
    : [
        { name: 'minute',     min: 0,  max: 59 },
        { name: 'hour',       min: 0,  max: 23 },
        { name: 'day-of-month', min: 1, max: 31 },
        { name: 'month',      min: 1,  max: 12 },
        { name: 'day-of-week', min: 0, max: 7 },
      ];

  for (let i = 0; i < parts.length; i++) {
    const field = parts[i];
    const { name, min, max } = ranges[i];
    if (field === '*' || field === '?') continue;
    // Handle step: */5 or 0-59/5
    const withStep = /^(.+)\/(\d+)$/.exec(field);
    const checkField = withStep ? withStep[1] : field;
    if (checkField === '*') continue;
    // Handle range: 1-5
    const range = /^(\d+)-(\d+)$/.exec(checkField);
    if (range) {
      if (parseInt(range[1]) < min || parseInt(range[2]) > max) return `${name} range ${checkField} out of ${min}-${max}`;
      continue;
    }
    // Handle list: 1,2,3
    const list = checkField.split(',');
    for (const v of list) {
      const n = parseInt(v);
      if (isNaN(n) || n < min || n > max) return `${name} value "${v}" out of ${min}-${max}`;
    }
  }
  return null; // valid
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));
  const error = parseCron(spec.cronExpression);
  if (error) return { pass: false, code: 'SJ002', message: `Invalid cron expression "${spec.cronExpression}": ${error}` };
  return { pass: true, code: 'SJ002', message: `Cron expression valid: "${spec.cronExpression}"` };
}
