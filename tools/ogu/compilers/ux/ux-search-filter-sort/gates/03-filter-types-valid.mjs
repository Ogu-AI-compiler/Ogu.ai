/**
 * Gate USS003 — filter-types-valid
 * Every filter.type must be one of:
 * "text" | "select" | "multi-select" | "range" | "date-range" | "boolean" | "tag"
 * Invalid types are collected as violations.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_FILTER_TYPES = new Set([
  'text',
  'select',
  'multi-select',
  'range',
  'date-range',
  'boolean',
  'tag',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS003',
      message: 'search-filter-sort-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'USS003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.filters)) {
    return {
      pass: true,
      code: 'USS003',
      message: 'No filters array — skipped',
      skipped: true,
    };
  }

  if (spec.filters.length === 0) {
    return {
      pass: true,
      code: 'USS003',
      message: 'filter-types-valid: no filters declared — nothing to validate',
    };
  }

  const violations = [];
  spec.filters.forEach((f, i) => {
    const id = f.id || `filters[${i}]`;
    if (typeof f.type !== 'string') {
      violations.push(`${id}: type is not a string`);
    } else if (!VALID_FILTER_TYPES.has(f.type)) {
      violations.push(
        `${id}: invalid type "${f.type}" — must be one of: ${[...VALID_FILTER_TYPES].join(', ')}`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS003',
      message: `${violations.length} filter(s) have invalid type`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS003',
    message: `filter-types-valid: all ${spec.filters.length} filter(s) have valid types`,
  };
}
