/**
 * Gate: drill-schedule (RVS004)
 * An automated restore drill schedule must be defined. A backup that has
 * never been restored is not a tested backup — it is an assumption that
 * the restore will work when it matters most.
 *
 * drill_schedule must declare:
 * - frequency: "daily" | "weekly" | "monthly"
 * - automated: true (manual drills are insufficient for regular cadence)
 *
 * Monthly is the minimum acceptable frequency for production.
 * Weekly is required for RPO < 4h.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];
const ACCEPTABLE_PRODUCTION_FREQUENCIES = ['daily', 'weekly', 'monthly'];

export async function run({ dir }) {
  const specPath = join(dir, 'restore-verification-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RVS004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RVS004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.drill_schedule) {
    return {
      pass: false,
      code: 'RVS004',
      message: 'drill_schedule is required',
      detail:
        'A backup without a regular restore drill is an untested backup.\n' +
        'Declare drill_schedule with frequency and automated: true.',
    };
  }

  const schedule = spec.drill_schedule;
  const violations = [];

  if (!schedule.frequency) {
    violations.push('drill_schedule.frequency is required (daily, weekly, or monthly)');
  } else if (!VALID_FREQUENCIES.includes(schedule.frequency)) {
    violations.push(`drill_schedule.frequency "${schedule.frequency}" is not valid (${VALID_FREQUENCIES.join(', ')})`);
  } else if (!ACCEPTABLE_PRODUCTION_FREQUENCIES.includes(schedule.frequency)) {
    violations.push(`drill_schedule.frequency "${schedule.frequency}" is too infrequent for production. Use monthly, weekly, or daily.`);
  }

  if (schedule.automated !== true) {
    violations.push(
      'drill_schedule.automated must be true. Manual drills are unreliable and often skipped. ' +
      'Configure an automated restore drill in your CI/CD or scheduled jobs.'
    );
  }

  // For low RPO, weekly minimum
  if (typeof spec.rpo_hours === 'number' && spec.rpo_hours < 4) {
    if (schedule.frequency === 'monthly') {
      violations.push(
        `rpo_hours is ${spec.rpo_hours}h (< 4h) but drill_schedule.frequency is "monthly". ` +
        'With a sub-4-hour RPO, restore drills must run at least weekly.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RVS004',
      message: `${violations.length} drill schedule issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RVS004',
    message: `Automated ${schedule.frequency} drill schedule configured`,
  };
}
