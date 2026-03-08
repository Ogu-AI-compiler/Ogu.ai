/**
 * Gate UDT008 — contract-data-table
 * Final contract check:
 * - version declared
 * - unique column ids
 * - pagination.pageSize > 0
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT008',
      message: 'data-table-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UDT008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: data-table-spec.json missing field "version"');
  }

  if (Array.isArray(spec.columns)) {
    const seenIds = new Map();
    spec.columns.forEach((col, i) => {
      if (typeof col.id !== 'string') return;
      if (seenIds.has(col.id)) {
        violations.push(`Contract: Duplicate column id "${col.id}"`);
      } else {
        seenIds.set(col.id, true);
      }
    });
  }

  const pageSize = spec.pagination?.pageSize;
  if (typeof pageSize !== 'number' || pageSize <= 0) {
    violations.push(
      `Contract: pagination.pageSize must be a number > 0 (got ${pageSize === undefined ? 'missing' : pageSize})`
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDT008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDT008',
    message: 'contract-data-table: all contract rules satisfied',
  };
}
