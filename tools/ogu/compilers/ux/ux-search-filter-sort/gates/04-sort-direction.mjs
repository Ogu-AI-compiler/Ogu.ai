/**
 * Gate USS004 — sort-direction
 * Every sort entry must declare defaultDirection: "asc" | "desc"
 * Missing direction means undefined initial sort behavior.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_DIRECTIONS = new Set(['asc', 'desc']);

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS004',
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
      code: 'USS004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.sorts)) {
    return {
      pass: true,
      code: 'USS004',
      message: 'No sorts array — skipped',
      skipped: true,
    };
  }

  if (spec.sorts.length === 0) {
    return {
      pass: true,
      code: 'USS004',
      message: 'sort-direction: no sorts declared — nothing to validate',
    };
  }

  const violations = [];
  spec.sorts.forEach((s, i) => {
    const id = s.id || `sorts[${i}]`;
    if (typeof s.defaultDirection !== 'string') {
      violations.push(`${id}: defaultDirection is missing — must be "asc" or "desc"`);
    } else if (!VALID_DIRECTIONS.has(s.defaultDirection)) {
      violations.push(
        `${id}: defaultDirection="${s.defaultDirection}" is invalid — must be "asc" or "desc"`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS004',
      message: `${violations.length} sort entry/entries missing or invalid defaultDirection`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS004',
    message: `sort-direction: all ${spec.sorts.length} sort(s) have valid defaultDirection`,
  };
}
