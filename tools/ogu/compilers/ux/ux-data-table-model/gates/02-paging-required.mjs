/**
 * Gate UDT002 — paging-required
 * If spec.estimatedRowCount > 25 or spec.pagination.required:true,
 * pagination.pageSize must be > 0 and <= 100.
 * Tables with no declared paging for large datasets are violations.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT002',
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
      code: 'UDT002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const rowCount = spec.estimatedRowCount;
  const paginationRequired = spec.pagination?.required === true;
  const needsPaging = (typeof rowCount === 'number' && rowCount > 25) || paginationRequired;

  if (!needsPaging) {
    return {
      pass: true,
      code: 'UDT002',
      message: 'paging-required: estimatedRowCount <= 25 and pagination.required not set — gate not applicable',
    };
  }

  const pageSize = spec.pagination?.pageSize;

  if (typeof pageSize !== 'number' || pageSize <= 0) {
    return {
      pass: false,
      code: 'UDT002',
      message: `Table expects large dataset (estimatedRowCount=${rowCount ?? 'n/a'}, required=${paginationRequired}) but pagination.pageSize is missing or <= 0`,
    };
  }

  if (pageSize > 100) {
    return {
      pass: false,
      code: 'UDT002',
      message: `pagination.pageSize=${pageSize} exceeds maximum of 100 — large pages cause performance issues`,
    };
  }

  return {
    pass: true,
    code: 'UDT002',
    message: `paging-required: pageSize=${pageSize} is valid for estimatedRowCount=${rowCount ?? 'n/a'}`,
  };
}
