/**
 * Gate USS007 — contract-search-filter-sort
 * Final contract check:
 * - version declared
 * - entity declared
 * - unique filter ids
 * - unique sort ids
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS007',
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
      code: 'USS007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: search-filter-sort-spec.json missing field "version"');
  }

  if (typeof spec.entity !== 'string' || spec.entity.trim() === '') {
    violations.push('Contract: entity (string) is missing or empty');
  }

  if (Array.isArray(spec.filters)) {
    const seenFilterIds = new Map();
    spec.filters.forEach((f, i) => {
      if (typeof f.id !== 'string') return;
      if (seenFilterIds.has(f.id)) {
        violations.push(`Contract: Duplicate filter id "${f.id}"`);
      } else {
        seenFilterIds.set(f.id, true);
      }
    });
  }

  if (Array.isArray(spec.sorts)) {
    const seenSortIds = new Map();
    spec.sorts.forEach((s, i) => {
      if (typeof s.id !== 'string') return;
      if (seenSortIds.has(s.id)) {
        violations.push(`Contract: Duplicate sort id "${s.id}"`);
      } else {
        seenSortIds.set(s.id, true);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS007',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS007',
    message: 'contract-search-filter-sort: all contract rules satisfied',
  };
}
