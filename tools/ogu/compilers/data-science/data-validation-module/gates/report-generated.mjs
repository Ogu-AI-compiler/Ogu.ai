import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DV005 — report-generated
 * Data validation modules must generate a human-readable validation report
 * that stakeholders (data engineers, scientists, business analysts) can review.
 *
 * Why:
 * - Programmatic validation (schema.validate(df) raising exceptions) tells
 *   developers when data is bad. It doesn't tell stakeholders WHY, HOW BAD,
 *   or WHAT CHANGED compared to last run.
 * - Validation reports serve multiple audiences:
 *   - Data engineers: which rows failed which checks, for debugging
 *   - Data scientists: distribution statistics to understand data quality trends
 *   - Business stakeholders: high-level quality score over time
 * - Great Expectations Data Docs, Pandera HTML reports, and Evidently reports
 *   all provide shareable, versioned documentation of data quality state.
 * - Reports enable data quality SLAs: "95% of columns must pass validation
 *   with ≥99% row-level validity." Without reports, this SLA cannot be tracked.
 *
 * Escape hatch: add "reportsExternal": true to validation-spec.json if
 * reporting is handled by an external data observability platform (Monte Carlo,
 * Acceldata, Bigeye).
 */

const REPORT_PATTERNS = [
  /\.build_data_docs\s*\(\)/,
  /validation_result\.to_json/,
  /\.to_html\s*\(/,
  /to_json.*validation|validation.*to_json/i,
  /DataQualityReport/,
  /deepchecks.*run\s*\(\)/,
  /evidently.*Dashboard|evidently.*Report/,
  /whylogs.*log/,
  /report\.save\s*\(/,
  /pandera.*yaml|schema.*to_yaml|schema.*to_json/i,
];

export async function run({ dir }) {
  let spec = {};
  try { spec = JSON.parse(readFileSync(join(dir, 'validation-spec.json'), 'utf8')); }
  catch { /* spec optional for this gate */ }

  if (spec.reportsExternal === true) {
    return { pass: true, code: 'DV005', message: 'Validation reporting handled by external observability platform', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DV005', message: 'No Python files — report check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasReport = REPORT_PATTERNS.some(p => p.test(content));

  if (!hasReport) {
    return {
      pass: false, code: 'DV005',
      message: 'No validation report generation found',
      detail: 'Add report generation:\n\n' +
        '  # Great Expectations\n' +
        '  context.build_data_docs()\n' +
        '  suite.run_validation_operator(\n' +
        '      "action_list_operator", assets_to_validate=[batch]\n' +
        '  )\n\n' +
        '  # Pandera — export schema stats\n' +
        '  try:\n' +
        '      validated_df = schema.validate(df, lazy=True)\n' +
        '  except pa.errors.SchemaErrors as e:\n' +
        '      report = e.failure_cases.to_json("validation_report.json", orient="records")\n\n' +
        '  # Evidently\n' +
        '  from evidently.report import Report\n' +
        '  report = Report(metrics=[DataQualityMetrics()])\n' +
        '  report.run(reference_data=ref_df, current_data=df)\n' +
        '  report.save_html("validation_report.html")',
    };
  }

  return { pass: true, code: 'DV005', message: 'Validation report generation present' };
}
