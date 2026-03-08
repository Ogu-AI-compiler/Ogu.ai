import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DS009 — contract-schema
 * Verifies that the data schema spec satisfies all schema contract requirements:
 * dataset named, columns typed, versioned, and described.
 *
 * Why:
 * - An unversioned schema cannot be tracked over time: when columns change,
 *   there is no way to know which version of the schema a dataset was validated
 *   against, breaking reproducibility for old model training runs.
 * - A schema without a description is undiscoverable in a data catalog:
 *   engineers cannot determine whether a schema is the right one to use
 *   without reading the entire column list.
 * - All-typed columns is the contract for downstream feature pipeline gates:
 *   if even one column lacks a dtype, the type-safety chain is broken.
 *
 * Escape hatch: none — these are non-negotiable for production data schemas.
 */

const RULES = [
  {
    id: 'has-dataset',
    description: 'dataset name defined',
    test: s => !!s.dataset,
  },
  {
    id: 'has-columns',
    description: 'columns array is non-empty',
    test: s => Array.isArray(s.columns) && s.columns.length > 0,
  },
  {
    id: 'all-typed',
    description: 'all columns have a dtype declared',
    test: s => s.columns?.every(c => !!c.dtype),
  },
  {
    id: 'has-version',
    description: 'schema has a version field (for schema evolution tracking)',
    test: s => !!s.version,
  },
  {
    id: 'has-description',
    description: 'schema has a human-readable description',
    test: s => !!s.description,
  },
];

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DS009', message: 'data-schema-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS009', message: 'data-schema-spec.json is invalid JSON' }; }

  const violations = RULES.filter(r => !r.test(spec));

  if (violations.length) {
    return {
      pass: false, code: 'DS009',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'DS009', message: 'All schema contract rules passed' };
}
