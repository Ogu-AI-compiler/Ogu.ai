import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * TH004 — network-blocked
 * In unit test mode, real network calls must be blocked by default.
 * Patterns: msw, nock, jest.mock fetch, vi.mock, unstable_mockModule, setupServer
 */

const NETWORK_BLOCK_PATTERNS = [
  /setupServer\s*\(/,          // msw
  /nock\s*\(/,                 // nock
  /vi\.mock.*fetch/,           // vitest mock
  /jest\.mock.*fetch/,         // jest mock
  /jest\.mock.*axios/,
  /vi\.mock.*axios/,
  /globalThis\.fetch\s*=/,     // global fetch override
  /global\.fetch\s*=/,
  /fetchMock/i,
  /msw/,
  /unstable_mockModule.*fetch/,
];

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  const root = projectRoot || dir;

  // Check if unit environment explicitly has network blocked
  const unitEnv = spec.environments.find(e =>
    e.name?.toLowerCase().includes('unit') || e.name?.toLowerCase().includes('node')
  );

  if (unitEnv?.networkBlocked === false) {
    return {
      pass: false, code: 'TH004',
      message: 'Unit test environment explicitly declares networkBlocked:false — this is not allowed',
      detail: 'Unit tests must not hit live network. Use msw or vi.mock to intercept HTTP calls.'
    };
  }

  // Look for network blocking setup in test setup files
  const setupCandidates = [
    'test/setup.ts', 'test/setup.js', 'src/test/setup.ts',
    'vitest.setup.ts', 'jest.setup.ts', 'test/setupTests.ts'
  ];

  let setupContent = '';
  for (const candidate of setupCandidates) {
    const p = join(root, candidate);
    if (existsSync(p)) { setupContent += readFileSync(p, 'utf8'); }
    const p2 = join(dir, candidate);
    if (existsSync(p2)) { setupContent += readFileSync(p2, 'utf8'); }
  }

  if (!setupContent) {
    // No setup file yet — warn but don't fail if spec declares networkBlocked:true
    if (unitEnv?.networkBlocked === true) {
      return {
        pass: true, code: 'TH004',
        message: 'Unit env declares networkBlocked:true in spec — setup file not yet created'
      };
    }
    return {
      pass: false, code: 'TH004',
      message: 'No test setup file found and no networkBlocked:true in spec',
      detail: 'Create test/setup.ts with msw setupServer or mock fetch, and reference it in runner config setupFiles'
    };
  }

  const hasBlock = NETWORK_BLOCK_PATTERNS.some(p => p.test(setupContent));
  if (!hasBlock) {
    return {
      pass: false, code: 'TH004',
      message: 'Test setup file does not block network calls',
      detail: 'Add: import { server } from "./mocks/server"; beforeAll(() => server.listen()); afterAll(() => server.close())'
    };
  }

  return { pass: true, code: 'TH004', message: 'Network calls blocked in unit test environment' };
}
