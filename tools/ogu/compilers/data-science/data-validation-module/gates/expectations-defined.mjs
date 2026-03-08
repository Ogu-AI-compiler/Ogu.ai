import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DV002 — expectations-defined
 * Data validation modules must define explicit data quality expectations
 * using a validation framework (pandera, Great Expectations, or equivalent).
 *
 * Why:
 * - "Data validation" without formally declared expectations is not validation —
 *   it's wishful thinking. A validation module that only logs "data loaded
 *   successfully" provides no protection against schema drift, corrupt values,
 *   or missing records.
 * - Explicit expectations are executable documentation: they describe what
 *   the data MUST look like, and they raise errors when reality diverges.
 *   This is the data equivalent of type annotations in a statically-typed language.
 * - Expectations enable automated regression testing of data pipelines:
 *   run expectations on historical data, run on new data, compare — instant
 *   signal if data distribution shifted significantly.
 * - Great Expectations produces HTML reports for data stakeholders.
 *   Pandera integrates with pandas type system. Both are production-ready.
 *
 * Required: at least one formally declared expectation in code or spec.
 *
 * Escape hatch: add "expectationsExternal": true to validation-spec.json
 * if expectations are declared in an external Great Expectations suite file.
 */

const EXPECTATION_PATTERNS = [
  /pa\.DataFrameSchema\s*\(/,
  /pa\.Column\s*\(/,
  /pa\.Check\s*\./,
  /pandera\./,
  /ExpectationSuite\s*\(/,
  /expect_column_to_exist/,
  /expect_column_values_to_be_between/,
  /expect_column_values_to_not_be_null/,
  /expect_table_row_count_to_be_between/,
  /great_expectations/,
  /class\s+\w+\s*\(\s*pa\.SchemaModel\s*\)/,
  /class\s+\w+\s*\(\s*pa\.DataFrameModel\s*\)/,
  /\.validate\s*\(\s*df/,
  /cerberus|voluptuous|jsonschema.*validate/,
];

export async function run({ dir }) {
  let spec = {};
  try { spec = JSON.parse(readFileSync(join(dir, 'validation-spec.json'), 'utf8')); }
  catch { /* spec not required for this gate */ }

  if (spec.expectationsExternal === true) {
    return { pass: true, code: 'DV002', message: 'Expectations defined in external GE suite', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.json'));
  if (!files.length) {
    return { pass: false, code: 'DV002', message: 'No Python or JSON files found in validation module' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const matched = EXPECTATION_PATTERNS.find(p => p.test(content));

  if (!matched) {
    return {
      pass: false, code: 'DV002',
      message: 'No data validation expectations found',
      detail: 'Add pandera schema validation:\n\n' +
        '  import pandera as pa\n\n' +
        '  schema = pa.DataFrameSchema({\n' +
        '      "user_id":   pa.Column(int, nullable=False, unique=True),\n' +
        '      "age":       pa.Column(float, pa.Check.between(0, 120), nullable=True),\n' +
        '      "status":    pa.Column(str, pa.Check.isin(["active", "inactive"])),\n' +
        '      "revenue":   pa.Column(float, pa.Check.ge(0)),\n' +
        '  })\n' +
        '  validated_df = schema.validate(df)\n\n' +
        'Or add "expectationsExternal": true to validation-spec.json for external GE suite.',
    };
  }

  return { pass: true, code: 'DV002', message: 'Data quality expectations defined using validation framework' };
}
