/**
 * Gate: max-indexes-per-table (IAS003)
 * After applying the advisory spec, no table should have more than 10 total
 * indexes (retained + added) without an explicit waiver.
 * More than 10 indexes on a write-heavy table causes severe write performance
 * degradation — every INSERT/UPDATE must maintain all indexes.
 *
 * Waiver: set index_limit_waiver: true on the table entry (requires justification).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MAX_INDEXES_WITHOUT_WAIVER = 10;

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'IAS003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IAS003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.indexes)) {
    return { pass: true, code: 'IAS003', message: 'No indexes array — gate skipped', skipped: true };
  }

  // Count projected indexes per table: existing_count + add - remove
  const tableData = {};

  for (const idx of spec.indexes) {
    const table = idx.table;
    if (!table) continue;

    if (!tableData[table]) {
      tableData[table] = {
        existing: idx.existing_index_count || 0,
        add: 0,
        remove: 0,
        hasWaiver: idx.index_limit_waiver === true,
        waiverJustification: idx.index_limit_waiver_justification || null,
      };
    }

    // Accumulate per-entry waiver
    if (idx.index_limit_waiver === true) {
      tableData[table].hasWaiver = true;
      if (idx.index_limit_waiver_justification) {
        tableData[table].waiverJustification = idx.index_limit_waiver_justification;
      }
    }

    if (idx.action === 'add') tableData[table].add++;
    if (idx.action === 'remove') tableData[table].remove++;
  }

  const violations = [];

  for (const [table, data] of Object.entries(tableData)) {
    const projected = data.existing + data.add - data.remove;

    if (projected > MAX_INDEXES_WITHOUT_WAIVER && !data.hasWaiver) {
      violations.push(
        `Table "${table}": projected index count (${projected}) exceeds maximum (${MAX_INDEXES_WITHOUT_WAIVER}). ` +
        'Set index_limit_waiver: true with a justification, or remove redundant indexes.'
      );
    }

    if (projected > MAX_INDEXES_WITHOUT_WAIVER && data.hasWaiver && !data.waiverJustification) {
      violations.push(
        `Table "${table}": index_limit_waiver is true but index_limit_waiver_justification is missing. ` +
        'Document why this table requires more than 10 indexes.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS003',
      message: `${violations.length} table(s) exceeding maximum index count`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'IAS003',
    message: 'All tables are within the maximum index limit',
  };
}
