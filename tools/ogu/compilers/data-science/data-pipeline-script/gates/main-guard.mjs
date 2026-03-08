import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP003 — main-guard
 * Data pipeline scripts must guard top-level execution with if __name__ == "__main__".
 *
 * Why: identical to MT002 reasoning — importability and orchestrator compatibility.
 *
 * Additional pipeline-specific context:
 * - Airflow, Prefect, and Luigi often import pipeline modules to inspect
 *   task parameters, dependencies, and metadata BEFORE running them.
 *   A missing main guard triggers the full pipeline on import.
 * - Test suites import pipeline modules to unit-test individual transform
 *   functions. Without the guard, importing runs the entire ETL.
 *
 * Escape hatch: # @no-main-guard-ok: <reason>
 */

const MAIN_GUARD_RE = /if\s+__name__\s*==\s*['"]__main__['"]/;
const TOP_LEVEL_IO_RE = /^(?:pd\.read_|spark\.read\.|open\s*\()/m;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP003', message: 'No Python files — main guard check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    if (/@no-main-guard-ok/.test(text)) continue;
    if (MAIN_GUARD_RE.test(text)) continue;

    // Only flag if there's top-level IO (actually runs something)
    if (TOP_LEVEL_IO_RE.test(text)) {
      violations.push(`${file}: top-level I/O without if __name__ == "__main__"`);
    } else {
      violations.push(`${file}: no if __name__ == "__main__" guard`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP003',
      message: `${violations.length} pipeline script(s) missing main guard`,
      detail: violations.join('\n') +
        '\n\nWrap execution:\n' +
        '  def run_pipeline(config):\n' +
        '      df = pd.read_parquet(config.input_path)\n' +
        '      result = transform(df)\n' +
        '      result.to_parquet(config.output_path)\n\n' +
        '  if __name__ == "__main__":\n' +
        '      import argparse\n' +
        '      args = parse_args()\n' +
        '      run_pipeline(load_config(args.config))',
    };
  }

  return { pass: true, code: 'DP003', message: 'if __name__ == "__main__" guard present in all pipeline scripts' };
}
