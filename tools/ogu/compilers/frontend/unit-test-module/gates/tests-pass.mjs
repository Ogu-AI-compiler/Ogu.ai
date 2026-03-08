import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx') || f.endsWith('.spec.ts') || f.endsWith('.spec.tsx'));
  if (!testFiles.length) return { pass: false, code: 'UT007', message: 'No test file found' };
  const runner = existsSync(join(root, 'vitest.config.ts')) || existsSync(join(root, 'vitest.config.js')) ? 'npx vitest run' : 'npx jest';
  try {
    execSync(`${runner} "${join(dir, testFiles[0])}" 2>&1`, { cwd: root, stdio: 'pipe' });
    return { pass: true, code: 'UT007', message: 'Tests passed' };
  } catch (e) {
    const out = e.stdout?.toString() || e.message;
    const summary = out.split('\n').filter(l => /FAIL|PASS|✓|✗|×|●/.test(l)).slice(0, 10).join('\n');
    return { pass: false, code: 'UT007', message: 'Tests failed', detail: summary };
  }
}
