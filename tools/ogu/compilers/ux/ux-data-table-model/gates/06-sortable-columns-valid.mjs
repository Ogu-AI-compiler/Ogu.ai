/**
 * Gate UDT006 — sortable-columns-valid
 * Any column with sortable:true must either:
 * - Have its field listed in spec.sortableColumns (array of field names), OR
 * - Have a corresponding sort definition (spec.sorts array entry matching the field)
 * A column marked sortable without a sort definition creates UI/API mismatch.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT006',
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
      code: 'UDT006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.columns)) {
    return {
      pass: true,
      code: 'UDT006',
      message: 'No columns array — skipped',
      skipped: true,
    };
  }

  const sortableColumns = Array.isArray(spec.sortableColumns) ? new Set(spec.sortableColumns) : new Set();
  const sortFieldSet = Array.isArray(spec.sorts)
    ? new Set(spec.sorts.map(s => s.field).filter(Boolean))
    : new Set();

  const sortableColsInSpec = spec.columns.filter(col => col.sortable === true);

  if (sortableColsInSpec.length === 0) {
    return {
      pass: true,
      code: 'UDT006',
      message: 'sortable-columns-valid: no columns marked sortable — gate not applicable',
    };
  }

  const violations = [];
  sortableColsInSpec.forEach(col => {
    const field = col.field;
    const inSortableColumns = sortableColumns.has(field);
    const inSorts = sortFieldSet.has(field);
    if (!inSortableColumns && !inSorts) {
      violations.push(
        `Column id="${col.id}" (field="${field}") is sortable:true but not in spec.sortableColumns or spec.sorts`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDT006',
      message: `${violations.length} sortable column(s) missing sort definition`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDT006',
    message: `sortable-columns-valid: all ${sortableColsInSpec.length} sortable column(s) have sort definitions`,
  };
}
