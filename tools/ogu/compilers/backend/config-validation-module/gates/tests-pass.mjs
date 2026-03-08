import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * CV009 — tests-pass
 * Runs all test files in the config-validation dir.
 * Tries vitest first, falls back to jest.
 */

function findTestFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'coverage'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(test|spec)\.(ts|mjs|js)$/)) {
        results.push(join(d, e.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir, projectRoot }) {
  const testFiles = findTestFiles(dir);

  if (testFiles.length === 0) {
    return {
      pass: false, code: 'CV009',
      message: 'No test files found — config module must have tests',
      detail: 'Create test files matching *.test.ts or *.spec.ts',
    };
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

    // Try to parse JSON output
    let parsed;
    try { parsed = JSON.parse(result.stdout || ''); } catch { /* text output */ }

    if (parsed) {
      // vitest / jest JSON format
      const numFailed = parsed.numFailedTests ?? parsed.numFailedTestSuites ?? 0;
      if (numFailed > 0) {
        const failures = (parsed.testResults ?? [])
          .flatMap(r => r.assertionResults ?? [])
          .filter(t => t.status === 'failed')
          .map(t => t.title)
          .slice(0, 8);
        return {
          pass: false, code: 'CV009',
          message: `${numFailed} config test(s) failed`,
          detail: failures.join('\n'),
        };
      }
      const numPassed = parsed.numPassedTests ?? 0;
      return {
        pass: true, code: 'CV009',
        message: `${numPassed} config test(s) passed (${testFiles.length} file(s))`,
      };
    }

    // Text output fallback
    if (result.status !== 0) {
      const output = ((result.stdout || '') + (result.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
      if (output.includes('not found') || output.includes('No such file')) continue;
      return {
        pass: false, code: 'CV009',
        message: 'Config tests failed',
        detail: output.slice(-2000),
      };
    }

    return {
      pass: true, code: 'CV009',
      message: `Config tests passed (${testFiles.length} file(s))`,
    };
  }

  return {
    pass: false, code: 'CV009',
    message: 'No test runner found — install vitest or jest in project root',
  };
}
