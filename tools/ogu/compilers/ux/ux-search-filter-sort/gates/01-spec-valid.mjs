/**
 * Gate USS001 — spec-valid
 * search-filter-sort-spec.json must exist with:
 * - entity (string)
 * - filters (array) — each with id, label, type
 * - sorts (array) — each with id, label, field
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS001',
      message: 'search-filter-sort-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'USS001',
      message: `search-filter-sort-spec.json parse error: ${err.message}`,
    };
  }

  const violations = [];

  if (typeof spec.entity !== 'string' || spec.entity.trim() === '') {
    violations.push('entity (string) is missing or empty');
  }
  if (!Array.isArray(spec.filters)) {
    violations.push('filters (array) is missing');
  }
  if (!Array.isArray(spec.sorts)) {
    violations.push('sorts (array) is missing');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS001',
      message: `search-filter-sort-spec.json missing required top-level fields: ${violations.join(', ')}`,
    };
  }

  const filterViolations = [];
  spec.filters.forEach((f, i) => {
    if (typeof f.id !== 'string' || f.id.trim() === '') {
      filterViolations.push(`filters[${i}] missing id (string)`);
    }
    if (typeof f.label !== 'string' || f.label.trim() === '') {
      filterViolations.push(`filters[${i}] missing label (string)`);
    }
    if (typeof f.type !== 'string' || f.type.trim() === '') {
      filterViolations.push(`filters[${i}] missing type (string)`);
    }
  });

  const sortViolations = [];
  spec.sorts.forEach((s, i) => {
    if (typeof s.id !== 'string' || s.id.trim() === '') {
      sortViolations.push(`sorts[${i}] missing id (string)`);
    }
    if (typeof s.label !== 'string' || s.label.trim() === '') {
      sortViolations.push(`sorts[${i}] missing label (string)`);
    }
    if (typeof s.field !== 'string' || s.field.trim() === '') {
      sortViolations.push(`sorts[${i}] missing field (string)`);
    }
  });

  const allViolations = [...filterViolations, ...sortViolations];
  if (allViolations.length > 0) {
    return {
      pass: false,
      code: 'USS001',
      message: `${allViolations.length} filter/sort entry/entries missing required fields`,
      detail: allViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS001',
    message: `spec-valid: entity="${spec.entity}", ${spec.filters.length} filter(s), ${spec.sorts.length} sort(s)`,
  };
}
