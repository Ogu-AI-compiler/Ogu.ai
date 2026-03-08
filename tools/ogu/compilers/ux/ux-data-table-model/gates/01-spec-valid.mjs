/**
 * Gate UDT001 — spec-valid
 * data-table-spec.json must exist with:
 * - table_id (string)
 * - columns (array) — each with id, label, field
 * - pagination (object) — with pageSize (number)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT001',
      message: 'data-table-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UDT001',
      message: `data-table-spec.json parse error: ${err.message}`,
    };
  }

  const violations = [];

  if (typeof spec.table_id !== 'string' || spec.table_id.trim() === '') {
    violations.push('table_id (string) is missing or empty');
  }
  if (!Array.isArray(spec.columns)) {
    violations.push('columns (array) is missing');
  }
  if (typeof spec.pagination !== 'object' || spec.pagination === null || Array.isArray(spec.pagination)) {
    violations.push('pagination (object) is missing');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDT001',
      message: `data-table-spec.json missing required top-level fields: ${violations.join(', ')}`,
    };
  }

  if (typeof spec.pagination.pageSize !== 'number') {
    return {
      pass: false,
      code: 'UDT001',
      message: 'pagination.pageSize (number) is missing',
    };
  }

  const columnViolations = [];
  spec.columns.forEach((col, i) => {
    if (typeof col.id !== 'string' || col.id.trim() === '') {
      columnViolations.push(`columns[${i}] missing id (string)`);
    }
    if (typeof col.label !== 'string' || col.label.trim() === '') {
      columnViolations.push(`columns[${i}] missing label (string)`);
    }
    if (typeof col.field !== 'string' || col.field.trim() === '') {
      columnViolations.push(`columns[${i}] missing field (string)`);
    }
  });

  if (columnViolations.length > 0) {
    return {
      pass: false,
      code: 'UDT001',
      message: `${columnViolations.length} column(s) missing required fields`,
      detail: columnViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDT001',
    message: `spec-valid: table_id="${spec.table_id}", ${spec.columns.length} column(s), pageSize=${spec.pagination.pageSize}`,
  };
}
