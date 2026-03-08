/**
 * Gate: test-schedule-defined (DR006)
 * Validates that a DR test schedule is defined. An untested runbook is
 * not a runbook — it is a document. DR procedures degrade as systems change,
 * and the only way to know they still work is to run them regularly.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const CRON_RE   = /^(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)$/;
const VALID_FREQ = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'annually']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));

  if (spec.skipTestSchedule) {
    return { pass: true, code: 'DR006', message: 'skipTestSchedule=true — test schedule check skipped', skipped: true };
  }

  if (!spec.testSchedule) {
    return {
      pass: false, code: 'DR006',
      message: 'testSchedule not defined — DR runbook must include regular test schedule',
      detail: { hint: 'Add testSchedule with frequency (daily/weekly/monthly/quarterly/annually) or a cron expression. Set skipTestSchedule: true for exemption.' },
    };
  }

  const { testSchedule } = spec;

  if (!testSchedule.frequency && !testSchedule.cron) {
    return {
      pass: false, code: 'DR006',
      message: 'testSchedule must define frequency or cron',
      detail: { hint: 'Use frequency: "quarterly" or cron: "0 0 1 */3 *"' },
    };
  }

  if (testSchedule.cron && !CRON_RE.test(testSchedule.cron.trim())) {
    return {
      pass: false, code: 'DR006',
      message: `testSchedule.cron "${testSchedule.cron}" is not a valid cron expression`,
      detail: { received: testSchedule.cron, hint: 'Use a 5-field cron expression (e.g., "0 0 1 */3 *" for quarterly)' },
    };
  }

  if (testSchedule.frequency && !VALID_FREQ.has(testSchedule.frequency.toLowerCase())) {
    return {
      pass: false, code: 'DR006',
      message: `testSchedule.frequency "${testSchedule.frequency}" is not a valid frequency`,
      detail: { received: testSchedule.frequency, allowed: [...VALID_FREQ] },
    };
  }

  return { pass: true, code: 'DR006', message: `DR test schedule: ${testSchedule.frequency || testSchedule.cron}` };
}
