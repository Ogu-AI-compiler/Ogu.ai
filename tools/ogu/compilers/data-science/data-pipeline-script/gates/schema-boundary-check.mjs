import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP007 — schema-boundary-check
 * Data pipeline scripts must validate schema at both input (read) and
 * output (write) boundaries — not just at one end.
 *
 * Why:
 * - Input schema validation catches upstream changes (source schema drift).
 * - Output schema validation catches transformation bugs (computed columns
 *   with wrong types, unexpected nulls introduced by joins, column renaming).
 * - Most pipelines validate only at input but not output. A bug in a
 *   downstream transformation can silently produce a malformed output
 *   that passes input validation in the NEXT pipeline stage — until it
 *   reaches a model that was trained on different output schema.
 * - The "fail fast at boundaries" principle: the sooner an error is detected,
 *   the cheaper it is to fix. A schema error at output is 10x cheaper than
 *   discovering it in model serving.
 *
 * Required: schema validation at both read AND write steps.
 * Input: pandera/great_expectations on loaded DataFrame.
 * Output: pandera/great_expectations/assertion on written DataFrame.
 *
 * Escape hatch: add "outputSchemaExternal": true to pipeline-spec.json if
 * output schema is enforced by the destination (e.g., typed Delta Lake table).
 */

const INPUT_VALIDATION = [
  /schema\.validate\s*\(/,
  /\.validate\s*\(\s*(?:df|data|raw_|loaded)/,
  /expect_column_to_exist/,
  /DataFrameSchema.*\.validate/,
];

const OUTPUT_VALIDATION = [
  /schema\.validate\s*\([^)]*(?:output|result|transformed|cleaned|processed)/,
  /output_schema\.validate/,
  /assert.*shape|assert.*columns|assert.*dtype/,
  /output.*validate|validate.*output/i,
  /ge_context.*run_checkpoint/,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'pipeline-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'DP007', message: 'pipeline-spec.json not readable' }; }

  if (spec.outputSchemaExternal === true) {
    return { pass: true, code: 'DP007', message: 'Output schema enforced by destination (external)', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP007', message: 'No Python files — schema boundary check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasInputValidation  = INPUT_VALIDATION.some(p => p.test(content));
  const hasOutputValidation = OUTPUT_VALIDATION.some(p => p.test(content));

  if (!hasInputValidation && !hasOutputValidation) {
    return {
      pass: false, code: 'DP007',
      message: 'No schema validation at input or output boundaries',
      detail: 'Add validation at both boundaries:\n\n' +
        '  # INPUT — validate immediately after reading\n' +
        '  raw_df = pd.read_parquet(INPUT_PATH)\n' +
        '  input_schema.validate(raw_df)  # pandera\n\n' +
        '  # ... transformations ...\n\n' +
        '  # OUTPUT — validate before writing\n' +
        '  output_schema.validate(result_df)\n' +
        '  result_df.to_parquet(OUTPUT_PATH)',
    };
  }

  if (!hasInputValidation) {
    return {
      pass: false, code: 'DP007',
      message: 'Output schema validated but input schema not validated',
      detail: 'Add input validation after reading data:\n  input_schema.validate(pd.read_parquet(INPUT_PATH))',
    };
  }

  if (!hasOutputValidation) {
    return {
      pass: false, code: 'DP007',
      message: 'Input schema validated but output schema not validated',
      detail: 'Add output validation before writing:\n  output_schema.validate(result_df)\n  result_df.to_parquet(OUTPUT_PATH)',
    };
  }

  return { pass: true, code: 'DP007', message: 'Schema validated at both input and output boundaries' };
}
