import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * TH003 — env-split-valid
 * Unit tests and integration tests must run in explicitly separate environments.
 * - Unit: node environment, no real DB/network
 * - Integration: real services, separate setup/teardown
 */

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  const root = projectRoot || dir;

  const envNames = spec.environments.map(e => e.name?.toLowerCase() || '');
  const hasUnit = envNames.some(n => n.includes('unit') || n.includes('node'));
  const hasIntegration = envNames.some(n => n.includes('integ') || n.includes('e2e') || n.includes('api'));

  if (!hasUnit) {
    return {
      pass: false, code: 'TH003',
      message: 'No unit test environment declared',
      detail: 'Add an environment with name "unit" or "node" in test-harness-spec.json environments[]'
    };
  }

  // Check that environments have distinct patterns
  const patternsSet = new Set(spec.environments.map(e => e.pattern).filter(Boolean));
  if (patternsSet.size < spec.environments.length) {
    return {
      pass: false, code: 'TH003',
      message: 'Multiple test environments share the same file pattern — environments must be distinct',
      detail: 'Each environment must have a unique pattern (e.g., "**/*.unit.test.ts" vs "**/*.integration.test.ts")'
    };
  }

  // Check the runner config for workspace or project definitions
  const configCandidates = ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js'];
  let configContent = '';
  for (const c of configCandidates) {
    const p = join(root, c);
    if (existsSync(p)) { configContent = readFileSync(p, 'utf8'); break; }
  }

  if (configContent) {
    const hasWorkspace = /workspace|projects\s*:|workspace\s*:/.test(configContent);
    const hasEnvironments = /environment|testEnvironment/.test(configContent);
    if (!hasWorkspace && !hasEnvironments && spec.environments.length > 1) {
      return {
        pass: false, code: 'TH003',
        message: 'Multiple environments declared in spec but runner config has no workspace/projects split',
        detail: 'Use vitest workspaces or jest projects to enforce distinct test environments'
      };
    }
  }

  return {
    pass: true, code: 'TH003',
    message: `Test environments properly split: ${spec.environments.map(e => e.name).join(', ')}`
  };
}
