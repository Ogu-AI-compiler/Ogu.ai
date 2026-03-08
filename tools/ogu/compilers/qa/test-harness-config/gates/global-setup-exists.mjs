import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * QA006 — global-setup-exists
 * If spec.globalSetup is declared, the file must exist on disk.
 * A missing global setup file is a silent failure: the runner uses no setup,
 * matchers aren't registered, teardown hooks don't run — tests pass locally
 * but fail in CI in mysterious ways.
 *
 * If globalSetup is not declared: skipped (not required).
 * If globalSetup is declared but file is missing: fail.
 */

export async function run({ dir, projectRoot }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA006', message: 'test-harness-spec.json not readable' };
  }

  const globalSetup = spec.globalSetup;
  if (!globalSetup) {
    return {
      pass: true, code: 'QA006',
      message: 'globalSetup not declared — skipped',
      skipped: true,
    };
  }

  // Resolve path relative to projectRoot or dir
  const root = projectRoot || dir;
  const candidates = [
    resolve(root, globalSetup),
    resolve(dir, globalSetup),
    // without extension
    resolve(root, globalSetup + '.ts'),
    resolve(root, globalSetup + '.mjs'),
    resolve(root, globalSetup + '.js'),
  ];

  const found = candidates.find(p => existsSync(p));
  if (!found) {
    return {
      pass: false, code: 'QA006',
      message: `globalSetup file not found: "${globalSetup}"`,
      detail: `Searched:\n${candidates.map(p => `  ${p}`).join('\n')}`,
    };
  }

  return {
    pass: true, code: 'QA006',
    message: `globalSetup file exists: ${globalSetup}`,
  };
}
