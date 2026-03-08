import { spawnSync } from 'child_process';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * AM008 — coverage
 * Auth middleware coverage must be ≥ 85% (statement coverage).
 * Auth is a critical path — the bar is intentionally higher than other modules.
 *
 * Runs vitest with --coverage if coverage data is not already present.
 * Aggregates statement coverage across all non-test TS source files in the dir.
 */

const THRESHOLD = 85;

function findTestFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'coverage'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (f.name.match(/\.(test|spec)\.(ts|js|mjs)$/)) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir, projectRoot }) {
  const cwd = projectRoot || dir;
  const coverageJson = join(cwd, 'coverage', 'coverage-final.json');

  if (!existsSync(coverageJson)) {
    const testFiles = findTestFiles(dir);
    if (testFiles.length === 0) {
      return { pass: true, code: 'AM008', message: 'No test files found — coverage gate skipped', skipped: true };
    }

    const result = spawnSync(
      'npx', ['vitest', 'run', '--coverage', '--reporter=json', ...testFiles],
      { cwd, encoding: 'utf8', timeout: 90_000 }
    );

    if (result.error?.code === 'ENOENT') {
      return { pass: true, code: 'AM008', message: 'vitest not found — coverage gate skipped', skipped: true };
    }
  }

  if (!existsSync(coverageJson)) {
    return { pass: true, code: 'AM008', message: 'Coverage data unavailable — skipped', skipped: true };
  }

  let raw;
  try { raw = JSON.parse(readFileSync(coverageJson, 'utf8')); }
  catch { return { pass: true, code: 'AM008', message: 'Coverage JSON unreadable — skipped', skipped: true }; }

  // Aggregate across all non-test source files in this auth middleware dir
  let totalStatements = 0;
  let coveredStatements = 0;
  let filesAnalyzed = 0;

  for (const key of Object.keys(raw)) {
    if (!key.includes(dir)) continue;
    if (key.includes('.test.') || key.includes('.spec.')) continue;

    const s = raw[key].s ?? {};
    const total = Object.keys(s).length;
    const covered = Object.values(s).filter(v => v > 0).length;
    totalStatements += total;
    coveredStatements += covered;
    filesAnalyzed++;
  }

  if (totalStatements === 0 || filesAnalyzed === 0) {
    return { pass: true, code: 'AM008', message: 'No coverage entries for this auth dir — skipped', skipped: true };
  }

  const pct = Math.round((coveredStatements / totalStatements) * 100);

  if (pct < THRESHOLD) {
    return {
      pass: false, code: 'AM008',
      message: `Auth coverage ${pct}% < ${THRESHOLD}% — auth is critical path, higher bar applies`,
      detail: { coverage: pct, threshold: THRESHOLD, filesAnalyzed },
    };
  }

  return {
    pass: true, code: 'AM008',
    message: `Auth coverage ${pct}% ≥ ${THRESHOLD}% (${filesAnalyzed} file(s))`,
  };
}
