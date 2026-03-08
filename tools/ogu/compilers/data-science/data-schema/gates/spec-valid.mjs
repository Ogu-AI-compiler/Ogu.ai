import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DS001 — spec-valid
 * Validates that data-schema-spec.json exists and each column has name + dtype.
 *
 * Why:
 * - A schema spec without column definitions is just a placeholder. Every
 *   column must have a name and dtype before downstream gates can enforce
 *   type constraints, range checks, and PII annotation requirements.
 * - Machine-readable column definitions enable automated pandera/Great
 *   Expectations test generation — without them, validation is manual and
 *   prone to drift from the actual data shape.
 *
 * Escape hatch: none — all non-trivial datasets must have a column spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DS001', message: 'data-schema-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS001', message: 'data-schema-spec.json is invalid JSON' }; }

  const required = ['dataset', 'columns'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'DS001', message: `data-schema-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
    return { pass: false, code: 'DS001', message: 'columns must be a non-empty array' };
  }

  const badCols = spec.columns.filter(c => !c.name || !c.dtype);
  if (badCols.length) {
    return {
      pass: false, code: 'DS001',
      message: `${badCols.length} column(s) missing required fields: ${badCols.map(c => c.name || '?').join(', ')} — each column needs name and dtype`,
    };
  }

  return { pass: true, code: 'DS001', message: `Spec valid: ${spec.dataset}, ${spec.columns.length} columns` };
}
