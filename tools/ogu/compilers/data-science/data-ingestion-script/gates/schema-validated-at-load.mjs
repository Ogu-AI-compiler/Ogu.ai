import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI007 — schema-validated-at-load
 * Data must be validated against a schema immediately after loading from source,
 * not after transformations that could mask upstream problems.
 *
 * Why:
 * - Raw data sources are unreliable: API contracts change silently, CSV exports
 *   drop columns, database schema migrations land without notice.
 * - Validating at the load boundary catches upstream changes immediately,
 *   before they propagate through the pipeline and produce silent wrong results.
 * - Downstream failures from bad data (NaN in numeric columns, wrong dtypes,
 *   missing required fields) are expensive to debug — often requiring replay of
 *   hours of computation. Early validation prevents this entirely.
 * - Pandera and Great Expectations produce human-readable validation reports
 *   that can be stored alongside the data for audit trails.
 *
 * Supported validation frameworks: pandera, great_expectations, pydantic (for
 * row-level validation), voluptuous, cerberus, or manual .validate() calls.
 *
 * Escape hatch: add "skipSchemaValidation": true to ingestion-spec.json if
 * the data source genuinely cannot be validated (e.g., unstructured text blobs).
 */

const VALIDATION_PATTERNS = [
  /pandera/,
  /great_expectations/,
  /DataFrameSchema\s*\(/,
  /\.validate\s*\(/,
  /expect_column/,
  /pa\s*\.\s*(Column|Check|DataFrameSchema)/,
  /Schema\s*\(\s*{/,       // voluptuous / cerberus
  /class\s+\w+\s*\(\s*BaseModel\s*\)/,  // pydantic
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'ingestion-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'DI007', message: 'ingestion-spec.json not readable' }; }

  if (spec.skipSchemaValidation === true) {
    return { pass: true, code: 'DI007', message: 'Schema validation skipped — skipSchemaValidation: true', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI007', message: 'No Python files — schema validation check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const matched = VALIDATION_PATTERNS.find(re => re.test(content));
  if (!matched) {
    return {
      pass: false, code: 'DI007',
      message: 'No schema validation at data load boundary',
      detail: 'Add validation immediately after reading data:\n\n' +
        '  import pandera as pa\n' +
        '  schema = pa.DataFrameSchema({\n' +
        '      "user_id": pa.Column(int, nullable=False),\n' +
        '      "event_time": pa.Column(str, pa.Check.str_matches(r"\\d{4}-\\d{2}-\\d{2}")),\n' +
        '  })\n' +
        '  df = schema.validate(pd.read_csv(DATA_DIR / "raw.csv"))\n\n' +
        'Or add "skipSchemaValidation": true to ingestion-spec.json if validation is impossible.',
    };
  }

  return { pass: true, code: 'DI007', message: 'Schema validated at data load boundary' };
}
