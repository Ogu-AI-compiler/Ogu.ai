import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  const root = projectRoot || dir;

  const configCandidates = spec.runner === 'vitest'
    ? ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs']
    : ['jest.config.ts', 'jest.config.js', 'jest.config.cjs'];

  let configFile = null;
  for (const candidate of configCandidates) {
    const p = join(root, candidate);
    if (existsSync(p)) { configFile = p; break; }
    // Also check in dir
    const p2 = join(dir, candidate);
    if (existsSync(p2)) { configFile = p2; break; }
  }

  if (!configFile) {
    return {
      pass: false, code: 'TH002',
      message: `${spec.runner} config file not found`,
      detail: `Expected one of: ${configCandidates.join(', ')} in project root or compiler directory`
    };
  }

  const content = readFileSync(configFile, 'utf8');

  // Basic structural check — must export a config object
  const hasExport = /export\s+default|module\.exports/.test(content);
  if (!hasExport) {
    return {
      pass: false, code: 'TH002',
      message: `${configFile.replace(root + '/', '')} does not export a config object`
    };
  }

  // Must reference test directory or include pattern
  const hasTestPattern = /include|testMatch|testPathPattern|test\s*\(/.test(content);
  if (!hasTestPattern) {
    return {
      pass: false, code: 'TH002',
      message: 'Config does not define test file patterns (include, testMatch, or testPathPattern)'
    };
  }

  return {
    pass: true, code: 'TH002',
    message: `${spec.runner} config found and structurally valid: ${configFile.replace(root + '/', '')}`
  };
}
