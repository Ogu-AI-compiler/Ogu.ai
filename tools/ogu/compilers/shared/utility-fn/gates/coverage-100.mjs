import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const THRESHOLD = 100;

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.ts'));
  if (!testFiles.length) return { pass: false, code: 'UF009', message: 'No test file found — utility functions require tests' };

  const isVitest = existsSync(join(root, 'vitest.config.ts')) || existsSync(join(root, 'vitest.config.js'));
  const cmd = isVitest
    ? `npx vitest run --coverage "${join(dir, testFiles[0])}" 2>&1`
    : `npx jest --coverage --coverageThreshold='{"global":{"lines":${THRESHOLD},"functions":${THRESHOLD},"branches":${THRESHOLD}}}' "${join(dir, testFiles[0])}" 2>&1`;

  try {
    const out = execSync(cmd, { cwd: root, stdio: 'pipe' }).toString();
    const match = out.match(/Lines\s*:\s*([\d.]+)%/i) || out.match(/All files\s*\|\s*([\d.]+)/);
    const pct = match ? parseFloat(match[1]) : null;

    if (pct !== null && pct < THRESHOLD) {
      return { pass: false, code: 'UF009', message: `Coverage ${pct.toFixed(1)}% — utility functions require 100% coverage` };
    }
    return { pass: true, code: 'UF009', message: pct ? `Coverage ${pct.toFixed(1)}%` : 'Coverage passed' };
  } catch (e) {
    return { pass: false, code: 'UF009', message: 'Coverage check failed', detail: e.stdout?.toString().slice(0, 300) };
  }
}
