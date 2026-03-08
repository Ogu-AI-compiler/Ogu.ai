import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const THRESHOLD = 80;

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));
  if (!testFiles.length) {
    return { pass: false, code: 'SS010', message: 'No test file found for coverage check' };
  }

  const isVitest = existsSync(join(root, 'vitest.config.ts')) || existsSync(join(root, 'vitest.config.js'));
  const cmd = isVitest
    ? `npx vitest run --coverage "${join(dir, testFiles[0])}" 2>&1`
    : `npx jest --coverage --coverageThreshold='{"global":{"lines":${THRESHOLD}}}' "${join(dir, testFiles[0])}" 2>&1`;

  try {
    const out = execSync(cmd, { cwd: root, stdio: 'pipe' }).toString();
    const match = out.match(/Lines\s*:\s*([\d.]+)%/i) || out.match(/(\d+(?:\.\d+)?)%\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*\d+/);
    const pct = match ? parseFloat(match[1]) : null;

    if (pct !== null && pct < THRESHOLD) {
      return { pass: false, code: 'SS010', message: `Coverage ${pct.toFixed(1)}% below ${THRESHOLD}% threshold` };
    }
    return { pass: true, code: 'SS010', message: pct ? `Coverage ${pct.toFixed(1)}%` : 'Coverage passed' };
  } catch (e) {
    return { pass: false, code: 'SS010', message: 'Coverage check failed', detail: e.stdout?.toString().slice(0, 300) };
  }
}
