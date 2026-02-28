/**
 * Sandbox Runtime Tests.
 *
 * 8 tests covering:
 *   Section 1: createSandbox (2 tests)
 *   Section 2: enforceSandbox (4 tests)
 *   Section 3: buildSandboxEnv + validateSandboxConfig (2 tests)
 */

import { createSandbox, enforceSandbox, buildSandboxEnv, validateSandboxConfig } from '../../runner/lib/sandbox-runtime.mjs';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: createSandbox
// ═══════════════════════════════════════════════════════════════════════

// 1. createSandbox returns config with $type
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: ['.env*'],
    networkAccess: false,
    maxMemoryMB: 1024,
    maxCpuPercent: 50,
  });
  assert(sandbox && sandbox.$type,
    'createSandbox returns config with $type');
}

// 2. createSandbox includes all specified paths
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**', 'tests/**'],
    blockedPaths: ['.env*', '.ogu/secrets*'],
    networkAccess: true,
  });
  assert(
    sandbox.allowedPaths?.length === 2 && sandbox.blockedPaths?.length === 2,
    'createSandbox includes all specified paths'
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: enforceSandbox
// ═══════════════════════════════════════════════════════════════════════

// 3. enforceSandbox allows permitted file paths
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: ['.env*'],
    networkAccess: false,
  });
  const result = enforceSandbox(sandbox, { type: 'file_read', path: 'src/app.ts' });
  assert(result && result.allowed === true,
    'enforceSandbox allows permitted file paths');
}

// 4. enforceSandbox blocks restricted paths
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: ['.env*'],
    networkAccess: false,
  });
  const result = enforceSandbox(sandbox, { type: 'file_read', path: '.env.production' });
  assert(result && result.allowed === false,
    'enforceSandbox blocks restricted paths');
}

// 5. enforceSandbox blocks network when disabled
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: [],
    networkAccess: false,
  });
  const result = enforceSandbox(sandbox, { type: 'network', host: 'example.com', port: 443 });
  assert(result && result.allowed === false,
    'enforceSandbox blocks network when disabled');
}

// 6. enforceSandbox blocks dangerous exec commands
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: [],
    networkAccess: false,
  });
  const result = enforceSandbox(sandbox, { type: 'exec', command: 'rm -rf /' });
  assert(result && result.allowed === false,
    'enforceSandbox blocks dangerous exec commands');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: buildSandboxEnv + validateSandboxConfig
// ═══════════════════════════════════════════════════════════════════════

// 7. buildSandboxEnv strips secret env vars
{
  const sandbox = createSandbox({
    allowedPaths: ['src/**'],
    blockedPaths: [],
    networkAccess: false,
  });
  const env = buildSandboxEnv(sandbox);
  assert(env && typeof env === 'object' && env.OGU_SANDBOXED === '1',
    'buildSandboxEnv returns env with OGU_SANDBOXED flag');
}

// 8. validateSandboxConfig catches invalid configs
{
  const valid = validateSandboxConfig(createSandbox({
    allowedPaths: ['src/**'], blockedPaths: [], networkAccess: false,
  }));
  const invalid = validateSandboxConfig(null);
  assert(valid.valid === true && invalid.valid === false,
    'validateSandboxConfig validates correctly');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nSandbox Runtime Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
