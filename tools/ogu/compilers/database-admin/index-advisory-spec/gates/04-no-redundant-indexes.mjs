/**
 * Gate: no-redundant-indexes (IAS004)
 * Detects redundant index additions — two indexes on the same table covering
 * the same columns in the same order are redundant. A prefix-redundant index
 * (index on [A] when [A, B] already exists) is also flagged.
 *
 * Redundant indexes consume storage and degrade write performance for no benefit.
 *
 * Escape hatch: redundant_ok: true on the index entry (e.g., for covering indexes
 * with different includes or partial predicates).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'IAS004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IAS004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.indexes)) {
    return { pass: true, code: 'IAS004', message: 'No indexes array — gate skipped', skipped: true };
  }

  // Group "add" and "retain" indexes by table
  const byTable = {};

  for (const idx of spec.indexes) {
    if (idx.action === 'remove') continue;
    if (!idx.table || !Array.isArray(idx.columns) || idx.columns.length === 0) continue;

    if (!byTable[idx.table]) {
      byTable[idx.table] = [];
    }
    byTable[idx.table].push(idx);
  }

  const violations = [];

  for (const [table, indexes] of Object.entries(byTable)) {
    for (let i = 0; i < indexes.length; i++) {
      const idx = indexes[i];
      if (idx.redundant_ok === true) continue;

      const colsA = idx.columns.map(c => String(c).toLowerCase().trim());

      for (let j = i + 1; j < indexes.length; j++) {
        const other = indexes[j];
        if (other.redundant_ok === true) continue;

        const colsB = other.columns.map(c => String(c).toLowerCase().trim());

        // Exact duplicate
        const isExactDuplicate = colsA.length === colsB.length &&
          colsA.every((c, k) => c === colsB[k]);

        if (isExactDuplicate) {
          violations.push(
            `Table "${table}": duplicate index on columns [${colsA.join(', ')}]. ` +
            'Remove one of the duplicate entries or mark with redundant_ok: true if intentional.'
          );
          continue;
        }

        // Prefix redundancy: [A] is redundant when [A, B] exists (PostgreSQL can use [A,B] for A-only queries)
        const isAPrefix = colsA.length < colsB.length &&
          colsA.every((c, k) => c === colsB[k]);

        if (isAPrefix) {
          violations.push(
            `Table "${table}": index on [${colsA.join(', ')}] is a prefix of index on [${colsB.join(', ')}]. ` +
            'The longer index can serve queries that only filter on the prefix columns. ' +
            'Remove the shorter index or mark redundant_ok: true if it has a specific predicate/include.'
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS004',
      message: `${violations.length} redundant index definition(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'IAS004',
    message: 'No redundant or duplicate index definitions detected',
  };
}
