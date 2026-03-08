/**
 * Gate: remove-has-reason (IAS006)
 * Every "remove" index action must have a reason field explaining why the
 * index is being dropped. Removed indexes are difficult to recreate on large
 * tables (CREATE INDEX CONCURRENTLY on a 100M-row table can take hours).
 * Without a documented reason, a dropped index cannot be audited or reversed.
 *
 * Valid reasons include: "unused (0 scans in 90 days)", "redundant with [idx_name]",
 * "table dropped", "replaced by partial index".
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'IAS006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IAS006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.indexes)) {
    return { pass: true, code: 'IAS006', message: 'No indexes array — gate skipped', skipped: true };
  }

  const removeIndexes = spec.indexes.filter(i => i.action === 'remove');

  if (removeIndexes.length === 0) {
    return {
      pass: true,
      code: 'IAS006',
      message: 'No "remove" index actions — reason check skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const idx of removeIndexes) {
    const label = idx.index_name
      ? `indexes[remove, index: "${idx.index_name}" on "${idx.table}"]`
      : `indexes[remove, table: "${idx.table}", columns: ${JSON.stringify(idx.columns)}]`;

    if (!idx.reason || typeof idx.reason !== 'string' || idx.reason.trim() === '') {
      violations.push(
        `${label}: "reason" is required for all "remove" actions. ` +
        'Recreating a dropped index on a large table can take hours — document why it is being removed.'
      );
      continue;
    }

    if (idx.reason.trim().length < 15) {
      violations.push(
        `${label}: reason "${idx.reason}" is too brief. ` +
        'Provide a meaningful explanation (e.g., "unused — 0 scans in past 90 days via pg_stat_user_indexes").'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS006',
      message: `${violations.length} "remove" index action(s) missing or have inadequate reason`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'IAS006',
    message: `All ${removeIndexes.length} "remove" index action(s) have documented reasons`,
  };
}
