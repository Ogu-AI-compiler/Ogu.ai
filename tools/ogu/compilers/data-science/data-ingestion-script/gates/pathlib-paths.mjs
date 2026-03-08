import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI002 — pathlib-paths
 * Python data ingestion scripts must use pathlib.Path for file operations,
 * not hardcoded OS-specific absolute paths.
 *
 * Why:
 * - Hardcoded paths like /home/user/data or C:\data break on every machine
 *   other than the author's. They make reproducibility and team collaboration
 *   impossible.
 * - os.path is acceptable (cross-platform) but pathlib is preferred: it's
 *   object-oriented, composes cleanly (Path(__file__).parent / "data"),
 *   and has better semantics (mkdir(parents=True, exist_ok=True)).
 * - The most common anti-pattern: open("/home/ubuntu/project/data/raw.csv").
 *   This works for the original author, breaks for everyone else, and breaks
 *   in CI/CD where home directories differ.
 *
 * Escape hatch: # @absolute-path-ok: <reason> on the offending line.
 */

// Patterns for hardcoded OS-specific absolute paths
const HARDCODED_UNIX_RE = /['"`](\/home\/|\/root\/|\/Users\/)[^'"`]+['"`]/;
const HARDCODED_WIN_RE  = /['"`][A-Za-z]:\\[^'"`]+['"`]/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI002', message: 'No Python files — path check skipped', skipped: true };
  }

  const violations = [];
  let hasPathlib = false;
  let hasOsPath  = false;

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (/from pathlib import|import pathlib/.test(text)) hasPathlib = true;
    if (/import os\b|from os import|os\.path/.test(text))  hasOsPath = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;

      // Escape hatch
      if (/@absolute-path-ok/.test(line) || (i > 0 && /@absolute-path-ok/.test(lines[i - 1]))) continue;

      if (HARDCODED_UNIX_RE.test(line) || HARDCODED_WIN_RE.test(line)) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DI002',
      message: `${violations.length} hardcoded absolute path(s)`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nReplace with:\n  from pathlib import Path\n  DATA_DIR = Path(__file__).parent.parent / "data"\n  df = pd.read_csv(DATA_DIR / "raw.csv")\n\nOr add # @absolute-path-ok: <reason> if path must be absolute.',
    };
  }

  if (!hasPathlib && !hasOsPath) {
    return {
      pass: false, code: 'DI002',
      message: 'No pathlib.Path or os.path usage — cannot verify cross-platform paths',
      detail: 'Data ingestion scripts must use:\n  from pathlib import Path\n  DATA_DIR = Path(__file__).parent.parent / "data"\nThis ensures the script works from any working directory.',
    };
  }

  const method = hasPathlib ? 'pathlib.Path' : 'os.path';
  return { pass: true, code: 'DI002', message: `Paths use ${method} — no hardcoded absolute paths` };
}
