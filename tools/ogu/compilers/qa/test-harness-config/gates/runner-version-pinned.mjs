import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA002 — runner-version-pinned
 * The test runner must be declared in devDependencies with a pinned exact version
 * (no ^ or ~ range specifiers). Range versions cause CI flakiness when minor
 * releases introduce breaking changes.
 *
 * Also checks that the runner is actually installed (in devDependencies).
 */

const RUNNER_PACKAGES = {
  vitest: ['vitest'],
  jest: ['jest', '@jest/core'],
  playwright: ['@playwright/test', 'playwright'],
  mocha: ['mocha'],
  jasmine: ['jasmine'],
};

function isExactVersion(v) {
  if (!v || typeof v !== 'string') return false;
  // Exact: "2.1.4", "1.0.0". Not exact: "^2", "~2", ">=1", "*", "latest"
  return /^\d+\.\d+\.\d+/.test(v) && !/[^0-9.]/.test(v.replace(/^\d+\.\d+\.\d+.*/, '').trim())
    || /^\d+\.\d+\.\d+$/.test(v);
}

export async function run({ dir, projectRoot }) {
  const specPath = join(dir, 'test-harness-spec.json');
  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: false, code: 'QA002', message: 'test-harness-spec.json not readable' };
  }

  const runner = spec.runner;
  const candidates = RUNNER_PACKAGES[runner] || [runner];

  // Find package.json from projectRoot or dir upward
  const roots = [projectRoot || dir, dir];
  let pkgJson = null;
  for (const root of roots) {
    const p = join(root, 'package.json');
    if (existsSync(p)) {
      try { pkgJson = JSON.parse(readFileSync(p, 'utf8')); break; } catch { /* continue */ }
    }
  }

  if (!pkgJson) {
    return { pass: false, code: 'QA002', message: 'package.json not found — cannot verify runner version' };
  }

  const devDeps = { ...(pkgJson.devDependencies || {}), ...(pkgJson.dependencies || {}) };

  // Find the runner package
  let foundPkg = null;
  let foundVersion = null;
  for (const pkg of candidates) {
    if (devDeps[pkg]) {
      foundPkg = pkg;
      foundVersion = devDeps[pkg];
      break;
    }
  }

  if (!foundPkg) {
    return {
      pass: false, code: 'QA002',
      message: `Test runner '${runner}' not found in devDependencies — expected one of: ${candidates.join(', ')}`,
    };
  }

  // Check for exact pinning
  const v = foundVersion;
  const hasRange = /[\^~><=*]/.test(v) || v === 'latest' || v === 'next';
  if (hasRange) {
    return {
      pass: false, code: 'QA002',
      message: `${foundPkg}@${v} uses range specifier — must be pinned exactly (e.g. "2.1.4")`,
      detail: `Range specifiers cause CI flakiness when patch releases introduce breaking changes. Remove ^ or ~ from "${v}"`,
    };
  }

  return {
    pass: true, code: 'QA002',
    message: `${foundPkg}@${v} — exact version pinned`,
  };
}
