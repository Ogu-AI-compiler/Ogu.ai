/**
 * Gate: rpo-met (DBP003)
 * The snapshot_frequency must be short enough to meet the RPO (Recovery Point
 * Objective). If snapshots run every 24 hours but RPO is 4 hours, a failure
 * midway through the day loses up to 24 hours of data — violating the SLA.
 *
 * Accepted snapshot_frequency formats: "Nh" (hours), "Nd" (days)
 * Rule: snapshot_frequency_hours <= rpo_hours
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DURATION_RE = /^(\d+)\s*(h|hour|hours|d|day|days)$/i;

function parseDurationToHours(duration) {
  const match = DURATION_RE.exec(String(duration).trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('d')) return value * 24;
  return value;
}

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DBP003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DBP003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.snapshot_frequency) {
    return {
      pass: false,
      code: 'DBP003',
      message: 'snapshot_frequency is required',
      detail: 'Declare snapshot_frequency as a duration like "24h" or "1d".',
    };
  }

  const freqHours = parseDurationToHours(spec.snapshot_frequency);
  if (freqHours === null) {
    return {
      pass: false,
      code: 'DBP003',
      message: `snapshot_frequency "${spec.snapshot_frequency}" is not a valid duration format`,
      detail: 'Use formats like "24h" (24 hours) or "1d" (1 day).',
    };
  }

  if (typeof spec.rpo_hours !== 'number') {
    return { pass: true, code: 'DBP003', message: 'rpo_hours not declared — RPO check skipped', skipped: true };
  }

  // With WAL archiving (PITR), snapshots don't need to match RPO exactly
  // — WAL fills the gap. But without PITR, snapshot frequency IS the RPO.
  const hasPitr = spec.wal_archiving === true && spec.pitr_window;

  if (!hasPitr && freqHours > spec.rpo_hours) {
    return {
      pass: false,
      code: 'DBP003',
      message: `snapshot_frequency (${freqHours}h) exceeds rpo_hours (${spec.rpo_hours}h) and no PITR is configured`,
      detail:
        `Without WAL archiving / PITR, the snapshot frequency determines the worst-case data loss.\n` +
        `A ${freqHours}h snapshot interval with a ${spec.rpo_hours}h RPO can lose up to ${freqHours}h of data.\n` +
        'Enable wal_archiving: true and set a pitr_window, or reduce snapshot_frequency.',
    };
  }

  return {
    pass: true,
    code: 'DBP003',
    message: `snapshot_frequency "${spec.snapshot_frequency}" (${freqHours}h) is compatible with rpo_hours (${spec.rpo_hours}h)${hasPitr ? ' — PITR covers the gap' : ''}`,
  };
}
