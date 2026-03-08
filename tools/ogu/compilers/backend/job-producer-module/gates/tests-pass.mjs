import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * JP008 — tests-pass
 * Runs all test files found in this module dir.
 * Supports any naming convention: *.test.ts, *.spec.ts, *.test.mjs, etc.
 */

function findTestFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'coverage'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (f.name.match(/\.(test|spec)\.(ts|mjs|js)$/)) {
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
    return { pass: false, code: 'JP008', message: 'No test files found — module must have tests (*.test.ts or *.spec.ts)' };
  }

  const cwd = projectRoot || dir;

  // Try vitest first, then jest
  const runners = [
    { args: ['vitest', 'run', '--reporter=json', ...testFiles] },
    { args: ['jest', '--testPathPattern', dir, '--no-coverage', '--json'] },
  ];

  for (const { args } of runners) {
    const result = spawnSync('npx', args, { cwd, encoding: 'utf8', timeout: 90_000 });

    if (result.error?.code === 'ENOENT') continue;

    let parsed;
    try { parsed = JSON.parse(result.stdout || ''); } catch { /* text output */ }

    if (parsed) {
      const numFailed = parsed.numFailedTests ?? 0;
      if (numFailed > 0) {
        const failures = (parsed.testResults ?? [])
          .flatMap(r => r.assertionResults ?? [])
          .filter(t => t.status === 'failed')
          .map(t => ({ title: t.title, message: (t.failureMessages ?? []).join('\n').slice(0, 200) }));
        return {
          pass: false, code: 'JP008',
          message: `${numFailed} test(s) failed`,
          detail: { failures: failures.slice(0, 5) },
        };
      }
      const numPassed = parsed.numPassedTests ?? 0;
      return {
        pass: true, code: 'JP008',
        message: `${numPassed} test(s) passed (${testFiles.length} file(s))`,
      };
    }

    // Text output fallback
    if (result.status !== 0) {
      const output = ((result.stdout || '') + (result.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
      if (output.includes('not found') || output.includes('No such file')) continue;
      return {
        pass: false, code: 'JP008',
        message: 'Tests failed',
        detail: output.slice(-2000),
      };
    }

    return {
      pass: true, code: 'JP008',
      message: `Tests passed (${testFiles.length} file(s))`,
    };
  }

  return {
    pass: false, code: 'JP008',
    message: 'No test runner found — install vitest or jest in project root',
  };
}
