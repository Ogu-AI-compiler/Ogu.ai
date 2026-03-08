/**
 * Gate: rto-quantitative (RVS002)
 * rto_hours must be a concrete numeric value, not a vague description like
 * "fast" or "acceptable". An RTO is only meaningful when it is measurable
 * and can be compared against actual restore drill results.
 *
 * Additionally, the RTO must be aligned with business requirements:
 * if rto_sla_hours is declared (the user-facing SLA), rto_hours must be
 * strictly less than rto_sla_hours (the technical target must be tighter
 * than the SLA to leave buffer for incident response).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VAGUE_DESCRIPTIONS = ['fast', 'quick', 'acceptable', 'tbd', 'unknown', 'soon', 'minimal'];

export async function run({ dir }) {
  const specPath = join(dir, 'restore-verification-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RVS002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RVS002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  // Check for string-based vague RTOs
  if (typeof spec.rto_hours === 'string') {
    const lower = spec.rto_hours.toLowerCase().trim();
    if (VAGUE_DESCRIPTIONS.includes(lower)) {
      return {
        pass: false,
        code: 'RVS002',
        message: `rto_hours "${spec.rto_hours}" is not a quantitative value`,
        detail:
          'RTO must be a concrete number of hours. Vague descriptions like "fast" or "acceptable" ' +
          'cannot be measured against actual restore drill results.\n' +
          'Example: rto_hours: 4',
      };
    }
    // Try to parse as a number anyway
    const parsed = parseFloat(spec.rto_hours);
    if (isNaN(parsed)) {
      return {
        pass: false,
        code: 'RVS002',
        message: `rto_hours "${spec.rto_hours}" is not a valid number`,
      };
    }
  }

  if (typeof spec.rto_hours !== 'number' || spec.rto_hours <= 0) {
    return {
      pass: false,
      code: 'RVS002',
      message: `rto_hours must be a positive number, got: ${JSON.stringify(spec.rto_hours)}`,
    };
  }

  // If rto_sla_hours is declared, technical RTO must be < SLA
  if (typeof spec.rto_sla_hours === 'number') {
    if (spec.rto_hours >= spec.rto_sla_hours) {
      return {
        pass: false,
        code: 'RVS002',
        message: `rto_hours (${spec.rto_hours}) must be < rto_sla_hours (${spec.rto_sla_hours})`,
        detail:
          'The technical RTO target must be shorter than the user-facing SLA to leave buffer for ' +
          'incident response, communication, and unexpected complications.',
      };
    }
  }

  return {
    pass: true,
    code: 'RVS002',
    message: `rto_hours: ${spec.rto_hours}h is a concrete quantitative target${spec.rto_sla_hours ? ` (SLA: ${spec.rto_sla_hours}h)` : ''}`,
  };
}
