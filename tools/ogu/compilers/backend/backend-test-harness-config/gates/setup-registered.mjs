import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * TH006 — setup-registered
 * The global setup file must be referenced in the runner config (setupFiles / globalSetup).
 * The setup file must register matchers or teardown hooks.
 */

const TEARDOWN_PATTERNS = [
  /afterAll\s*\(/,
  /afterEach\s*\(/,
  /globalTeardown/,
  /server\.close/,
  /prisma\.\$disconnect/,
  /pool\.end/,
  /redis\.quit/,
];

const MATCHER_PATTERNS = [
  /expect\.extend/,
  /addMatchers/,
  /import.*matchers/i,
];

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  const root = projectRoot || dir;

  // Check if runner config references setupFiles
  const configCandidates = ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js'];
  let configContent = '';
  for (const c of configCandidates) {
    const p = join(root, c);
    if (existsSync(p)) { configContent = readFileSync(p, 'utf8'); break; }
  }

  if (!configContent) {
    return {
      pass: false, code: 'TH006',
      message: 'Runner config not found — cannot verify setup file registration'
    };
  }

  const hasSetupFiles = /setupFiles|setupFilesAfterFramework|globalSetup|setup\.ts|setup\.js/.test(configContent);
  if (!hasSetupFiles) {
    return {
      pass: false, code: 'TH006',
      message: 'Runner config does not reference a setup file',
      detail: 'Add setupFiles: ["./test/setup.ts"] or globalSetup in your runner config'
    };
  }

  // Find and validate the setup file itself
  const setupCandidates = [
    'test/setup.ts', 'test/setup.js', 'test/setupTests.ts',
    'vitest.setup.ts', 'jest.setup.ts', 'src/test/setup.ts',
  ];

  let setupContent = '';
  let setupFile = null;
  for (const candidate of setupCandidates) {
    const p = join(root, candidate);
    if (existsSync(p)) { setupContent = readFileSync(p, 'utf8'); setupFile = candidate; break; }
    const p2 = join(dir, candidate);
    if (existsSync(p2)) { setupContent = readFileSync(p2, 'utf8'); setupFile = candidate; break; }
  }

  if (!setupFile) {
    // Config references setup but file doesn't exist
    return {
      pass: false, code: 'TH006',
      message: 'Runner config references setup file but setup file does not exist',
      detail: 'Create test/setup.ts with afterAll teardown hooks and optional matcher registrations'
    };
  }

  const hasTeardown = TEARDOWN_PATTERNS.some(p => p.test(setupContent));
  if (!hasTeardown) {
    return {
      pass: false, code: 'TH006',
      message: `${setupFile} does not register teardown hooks`,
      detail: 'Add afterAll cleanup: server.close(), prisma.$disconnect(), pool.end(), etc.'
    };
  }

  return {
    pass: true, code: 'TH006',
    message: `Setup file registered and valid: ${setupFile}`
  };
}
