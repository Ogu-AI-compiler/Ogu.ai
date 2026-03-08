import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DV003 — critical-columns-covered
 * All columns declared as "critical" in the validation spec must have
 * explicit expectations in the validation code.
 *
 * Why:
 * - Not all columns are equally important. Critical columns are those whose
 *   failure would cause model predictions to be meaningless or harmful:
 *   the target column, entity key, timestamp column, and primary feature columns.
 * - A validation suite that checks peripheral columns but not the critical
 *   ones provides false confidence: the report says "all checks passed" but
 *   the critical column with NaN values slipped through unchecked.
 * - Explicitly declaring critical columns creates accountability: someone had
 *   to think about which columns matter most, and the system verifies that
 *   those specific columns have validation coverage.
 * - Critical column coverage also documents business logic:
 *   "user_id must be non-null and unique" is a business requirement captured
 *   as a machine-checkable assertion.
 *
 * Escape hatch: add "coverageByFramework": true to validation-spec.json if
 * critical column coverage is enforced by the framework schema definition
 * (e.g., pandera SchemaModel with all columns declared as required fields).
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'validation-spec.json'), 'utf8')); }
  catch { return { pass: true, code: 'DV003', message: 'No validation-spec.json — coverage check skipped', skipped: true }; }

  if (spec.coverageByFramework === true) {
    return { pass: true, code: 'DV003', message: 'Coverage enforced by framework schema definition', skipped: true };
  }

  const critical = spec.critical_columns ?? [];
  if (!critical.length) {
    return { pass: true, code: 'DV003', message: 'No critical_columns specified in spec — skipped', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DV003', message: 'No Python files — coverage check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const uncovered = critical.filter(col => {
    // Check if column name appears in validation code
    const inCode = content.includes(`"${col}"`) || content.includes(`'${col}'`);
    return !inCode;
  });

  if (uncovered.length) {
    return {
      pass: false, code: 'DV003',
      message: `${uncovered.length}/${critical.length} critical column(s) not covered by validation`,
      detail: `Missing validation for: ${uncovered.join(', ')}\n\n` +
        'Add expectations for each critical column:\n' +
        '  schema = pa.DataFrameSchema({\n' +
        uncovered.slice(0, 3).map(col => `      "${col}": pa.Column(/* type */, nullable=False),`).join('\n') +
        '\n  })',
    };
  }

  return {
    pass: true, code: 'DV003',
    message: `All ${critical.length} critical column(s) covered by validation`,
  };
}
