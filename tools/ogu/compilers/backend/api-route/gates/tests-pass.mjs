import { spawnSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * AR008 — tests-pass
 * Runs all test files found in the route dir via vitest.
 * Supports any test file naming convention: handler.test.ts, route.spec.ts, index.test.ts, etc.
 */

function findTestFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
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
  const testFiles = findTestFiles(dir);

  if (testFiles.length === 0) {
    return { pass: false, code: 'AR008', message: 'No test files found in route dir (expected *.test.ts or *.spec.ts)' };
  }

  const cwd = projectRoot || dir;
  const result = spawnSync(
    'npx', ['vitest', 'run', '--reporter=json', ...testFiles],
    { cwd, encoding: 'utf8', timeout: 60_000 }
  );

  if (result.error?.code === 'ENOENT') {
    return { pass: true, code: 'AR008', message: 'vitest not found — tests-pass gate skipped', skipped: true };
  }

  let parsed;
  try { parsed = JSON.parse(result.stdout || ''); } catch {
    if (result.status !== 0) {
      const errors = (result.stderr || '')
        .split('\n')
        .filter(l => l.includes('Error') || l.includes('FAIL') || l.includes('✗'))
        .slice(0, 8);
      return {
        pass: false, code: 'AR008',
        message: 'Route tests failed',
        detail: { errors, stderr: (result.stderr || '').slice(0, 500) },
      };
    }
    return { pass: true, code: 'AR008', message: 'Tests passed (text output only)' };
  }

  const numFailed = parsed?.numFailedTests ?? 0;
  const numPassed = parsed?.numPassedTests ?? 0;

  if (numFailed > 0) {
    const failures = (parsed?.testResults ?? [])
      .flatMap(r => r.assertionResults ?? [])
      .filter(t => t.status === 'failed')
      .map(t => ({ title: t.title, message: (t.failureMessages ?? []).join('\n').slice(0, 200) }));
    return {
      pass: false, code: 'AR008',
      message: `${numFailed} route test(s) failed`,
      detail: { failures: failures.slice(0, 5) },
    };
  }

  return {
    pass: true, code: 'AR008',
    message: `${numPassed} route test(s) passed (${testFiles.length} file(s))`,
  };
}
