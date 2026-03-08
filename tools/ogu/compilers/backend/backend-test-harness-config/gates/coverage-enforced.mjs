import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * TH005 — coverage-enforced
 * Coverage thresholds must be declared in spec AND enforced in the runner config.
 * A threshold in spec but not in config means CI will silently pass with 0% coverage.
 */

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  const root = projectRoot || dir;
  const thresholds = spec.coverageThresholds;

  // All thresholds must be >= 0 and <= 100
  const thresholdKeys = ['lines', 'functions', 'branches', 'statements'];
  for (const key of thresholdKeys) {
    const val = thresholds[key];
    if (typeof val !== 'number' || val < 0 || val > 100) {
      return {
        pass: false, code: 'TH005',
        message: `coverageThresholds.${key} must be a number between 0-100, got: ${val}`
      };
    }
  }

  // Check runner config for coverage threshold enforcement
  const configCandidates = ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js'];
  let configContent = '';
  let configFile = null;
  for (const c of configCandidates) {
    const p = join(root, c);
    if (existsSync(p)) { configContent = readFileSync(p, 'utf8'); configFile = c; break; }
  }

  if (!configContent) {
    return {
      pass: false, code: 'TH005',
      message: 'Runner config not found — cannot verify coverage threshold enforcement'
    };
  }

  // Check for coverage threshold declarations
  const hasCoverageConfig = /coverage\s*[:{]/.test(configContent);
  const hasThreshold = /threshold|perFile|branches|lines|functions|statements/.test(configContent);

  if (!hasCoverageConfig) {
    return {
      pass: false, code: 'TH005',
      message: `${configFile} has no coverage configuration block`,
      detail: `Add a coverage section to ${configFile} matching the thresholds in test-harness-spec.json`
    };
  }

  if (!hasThreshold) {
    return {
      pass: false, code: 'TH005',
      message: `${configFile} has coverage config but no thresholds declared`,
      detail: `Coverage thresholds in spec: ${JSON.stringify(thresholds)} — add these to the runner config`
    };
  }

  return {
    pass: true, code: 'TH005',
    message: `Coverage thresholds enforced in ${configFile}: ${JSON.stringify(thresholds)}`
  };
}
