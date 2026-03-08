/**
 * Gate: write-heavy-not-over-indexed (IAS005)
 * Tables declared as write_heavy: true must not receive more than 3 new
 * index additions in a single advisory spec. Adding many indexes to a
 * write-heavy table compounds write latency — each insert must update every
 * index. For write-heavy tables, every new index needs strong justification.
 *
 * Waiver: set write_heavy_index_waiver: true with justification.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MAX_ADDS_FOR_WRITE_HEAVY = 3;

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'IAS005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IAS005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.indexes)) {
    return { pass: true, code: 'IAS005', message: 'No indexes array — gate skipped', skipped: true };
  }

  // Identify write-heavy tables
  const writeHeavyTables = {};
  for (const idx of spec.indexes) {
    if (!idx.table) continue;
    if (idx.write_heavy === true) {
      if (!writeHeavyTables[idx.table]) {
        writeHeavyTables[idx.table] = { addCount: 0, hasWaiver: false, waiverJustification: null };
      }
      writeHeavyTables[idx.table].hasWaiver = writeHeavyTables[idx.table].hasWaiver || idx.write_heavy_index_waiver === true;
      if (idx.write_heavy_index_waiver_justification) {
        writeHeavyTables[idx.table].waiverJustification = idx.write_heavy_index_waiver_justification;
      }
    }
  }

  // Count "add" actions per write-heavy table
  for (const idx of spec.indexes) {
    if (idx.action !== 'add') continue;
    if (!idx.table || !writeHeavyTables[idx.table]) continue;
    writeHeavyTables[idx.table].addCount++;
  }

  const writeHeavyEntries = Object.entries(writeHeavyTables);

  if (writeHeavyEntries.length === 0) {
    return {
      pass: true,
      code: 'IAS005',
      message: 'No write_heavy tables declared — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const [table, data] of writeHeavyEntries) {
    if (data.addCount <= MAX_ADDS_FOR_WRITE_HEAVY) continue;
    if (data.hasWaiver && data.waiverJustification) continue;

    if (data.hasWaiver && !data.waiverJustification) {
      violations.push(
        `Table "${table}" (write_heavy): write_heavy_index_waiver is true but write_heavy_index_waiver_justification is missing.`
      );
      continue;
    }

    violations.push(
      `Table "${table}" (write_heavy): ${data.addCount} new indexes added (maximum for write-heavy tables: ${MAX_ADDS_FOR_WRITE_HEAVY}). ` +
      'Each index on a write-heavy table increases write latency. Set write_heavy_index_waiver: true with justification, or reduce index additions.'
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS005',
      message: `${violations.length} write-heavy table(s) over-indexed`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'IAS005',
    message: `All ${writeHeavyEntries.length} write_heavy table(s) within index addition limit`,
  };
}
