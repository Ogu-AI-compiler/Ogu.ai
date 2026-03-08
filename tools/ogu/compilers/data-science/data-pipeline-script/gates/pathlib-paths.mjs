import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP001 — pathlib-paths
 * Data pipeline scripts must use pathlib.Path or os.path for file paths,
 * not hardcoded absolute paths.
 *
 * Why: identical to DI002 reasoning. Pipelines are run in CI/CD, Docker
 * containers, and cloud environments where absolute paths are never stable.
 *
 * Escape hatch: # @absolute-path-ok: <reason>
 */

const HARDCODED_UNIX_RE = /['"`](\/home\/|\/root\/|\/Users\/)[^'"`]+['"`]/;
const HARDCODED_WIN_RE  = /['"`][A-Za-z]:\\[^'"`]+['"`]/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP001', message: 'No Python files — path check skipped', skipped: true };
  }

  const violations = [];
  let hasPathlib = false;
  let hasOsPath  = false;

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (/from pathlib import|import pathlib/.test(text)) hasPathlib = true;
    if (/import os\b|os\.path/.test(text)) hasOsPath = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (/@absolute-path-ok/.test(line) || (i > 0 && /@absolute-path-ok/.test(lines[i - 1]))) continue;

      if (HARDCODED_UNIX_RE.test(line) || HARDCODED_WIN_RE.test(line)) {
        violations.push(`${file}:${i + 1} — ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP001',
      message: `${violations.length} hardcoded absolute path(s)`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nReplace with:\n  from pathlib import Path\n  INPUT_PATH = Path(__file__).parent.parent / "data" / "raw"\n  OUTPUT_PATH = Path(os.environ.get("OUTPUT_DIR", "/tmp/pipeline"))',
    };
  }

  if (!hasPathlib && !hasOsPath) {
    return {
      pass: false, code: 'DP001',
      message: 'No pathlib.Path or os.path usage',
      detail: 'from pathlib import Path\nINPUT_PATH = Path(__file__).parent.parent / "data" / "raw"',
    };
  }

  return { pass: true, code: 'DP001', message: `Paths use ${hasPathlib ? 'pathlib.Path' : 'os.path'} — no hardcoded absolute paths` };
}
