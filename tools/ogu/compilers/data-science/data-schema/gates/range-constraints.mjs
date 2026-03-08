import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DS005 — range-constraints
 * Numeric columns must declare min/max constraints or be explicitly marked
 * as unbounded with a documented reason.
 *
 * Why:
 * - Range constraints catch data quality issues immediately at ingestion:
 *   age=-5, revenue=-100000, latitude=999 are clearly wrong and should
 *   raise validation errors before they corrupt model training or predictions.
 * - Without range constraints, corrupted values propagate silently through
 *   the pipeline. A single outlier (e.g., age=999 from a default value)
 *   can skew normalization for all downstream training.
 * - Declared ranges inform feature engineering: a field declared as [0, 100]
 *   is likely a percentage and can be min-max scaled directly. A field
 *   declared as no_range_constraint is unbounded and needs robust scaling.
 * - At serving time, values outside the declared range should trigger
 *   monitoring alerts — they indicate distribution drift.
 *
 * Schema convention:
 *   { "name": "age",     "dtype": "int64",   "min": 0, "max": 120 }
 *   { "name": "revenue", "dtype": "float64", "min": 0 }
 *   { "name": "delta",   "dtype": "float64", "no_range_constraint": true, "reason": "signed difference" }
 *
 * Escape hatch: set no_range_constraint: true for genuinely unbounded fields.
 */

const NUMERIC_DTYPES = new Set([
  'int8','int16','int32','int64',
  'uint8','uint16','uint32','uint64',
  'float16','float32','float64',
  'int', 'float', 'number',
]);

function isNumeric(dtype) {
  if (!dtype) return false;
  const base = dtype.toLowerCase().replace(/numpy\.|np\./, '');
  return NUMERIC_DTYPES.has(base) || /^(?:int|float|uint)\d*$/.test(base);
}

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'DS005', message: 'No spec — range check skipped', skipped: true };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS005', message: 'data-schema-spec.json not parseable' }; }

  const numericCols = (spec.columns ?? []).filter(c => isNumeric(c.dtype));

  if (!numericCols.length) {
    return { pass: true, code: 'DS005', message: 'No numeric columns declared — check skipped', skipped: true };
  }

  const unconstrained = numericCols.filter(c =>
    c.min === undefined && c.max === undefined && !c.no_range_constraint
  );
  const unboundedNoReason = numericCols.filter(c =>
    c.no_range_constraint && !c.reason
  );

  const issues = [];

  for (const col of unconstrained) {
    issues.push(`Column "${col.name}" (${col.dtype}): no min/max and no_range_constraint not set`);
  }
  for (const col of unboundedNoReason) {
    issues.push(`Column "${col.name}": no_range_constraint but no reason documented`);
  }

  if (issues.length) {
    return {
      pass: false, code: 'DS005',
      message: `${issues.length} numeric column(s) without range constraints`,
      detail: issues.join('\n') +
        '\n\nAdd constraints:\n' +
        '  { "name": "age",       "dtype": "int64",   "min": 0, "max": 120 }\n' +
        '  { "name": "revenue",   "dtype": "float64", "min": 0 }\n' +
        '  { "name": "price_delta", "dtype": "float64",\n' +
        '    "no_range_constraint": true, "reason": "signed price difference, unbounded" }',
    };
  }

  const withBoth = numericCols.filter(c => c.min !== undefined && c.max !== undefined);
  return {
    pass: true, code: 'DS005',
    message: `${numericCols.length} numeric column(s) have range constraints (${withBoth.length} with min+max)`,
  };
}
