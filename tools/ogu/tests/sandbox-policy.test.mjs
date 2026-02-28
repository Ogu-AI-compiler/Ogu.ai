import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `sandbox-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu'), { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = TMP;

const {
  ISOLATION_TIERS,
  ensureSandboxConfig,
  resolveSandboxPolicy,
  validateFileAccess,
  validateToolAccess,
  validateNetworkAccess,
  validateAccess,
} = await import('../commands/lib/sandbox-policy.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    teardown();
  }
}

console.log('\n  sandbox-policy.mjs\n');

// ── ISOLATION_TIERS ──

test('ISOLATION_TIERS maps risk levels to isolation', () => {
  assert.equal(ISOLATION_TIERS.low, 'process');
  assert.equal(ISOLATION_TIERS.medium, 'worktree');
  assert.equal(ISOLATION_TIERS.high, 'container');
  assert.equal(ISOLATION_TIERS.critical, 'container');
});

// ── ensureSandboxConfig ──

test('ensureSandboxConfig creates config file if missing', () => {
  const config = ensureSandboxConfig(TMP);
  assert.ok(existsSync(join(TMP, '.ogu/sandbox-policy.json')));
  assert.equal(config.$schema, 'SandboxPolicy/1.0');
  assert.ok(config.policies.minimal);
  assert.ok(config.policies.standard);
  assert.ok(config.policies.privileged);
});

test('ensureSandboxConfig loads existing config', () => {
  writeFileSync(join(TMP, '.ogu/sandbox-policy.json'), JSON.stringify({
    $schema: 'SandboxPolicy/1.0',
    global: { defaultPolicy: 'standard' },
    policies: { custom: { description: 'Custom policy' } },
  }), 'utf8');
  const config = ensureSandboxConfig(TMP);
  assert.ok(config.policies.custom);
});

// ── resolveSandboxPolicy ──

test('resolveSandboxPolicy returns minimal for qa role', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'qa' });
  assert.equal(policy.policyName, 'minimal');
  assert.deepEqual(policy.tools.blocked, ['Bash', 'Write', 'Edit']);
});

test('resolveSandboxPolicy returns standard for backend-dev', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'backend-dev' });
  assert.equal(policy.policyName, 'standard');
  assert.ok(policy.tools.allowed.includes('Bash'));
});

test('resolveSandboxPolicy returns privileged for cto', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'cto' });
  assert.equal(policy.policyName, 'privileged');
  assert.ok(policy.tools.allowed.includes('*'));
});

test('resolveSandboxPolicy applies role override for architect', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'architect' });
  assert.equal(policy.policyName, 'standard+override');
  assert.ok(policy.tools.allowed.includes('WebSearch'));
  assert.ok(policy.filesystem.readScope.includes('**/*'));
});

test('resolveSandboxPolicy applies role override for pm', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'pm' });
  assert.equal(policy.policyName, 'minimal+override');
  assert.ok(policy.tools.allowed.includes('WebSearch'));
});

test('resolveSandboxPolicy returns default for unknown role', () => {
  ensureSandboxConfig(TMP);
  const policy = resolveSandboxPolicy({ root: TMP, roleId: 'unknown-role' });
  assert.equal(policy.policyName, 'standard');
});

// ── validateFileAccess ──

test('validateFileAccess allows read for backend-dev in src/', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'backend-dev', filePath: 'src/app.ts', mode: 'read' });
  assert.equal(result.allowed, true);
});

test('validateFileAccess blocks .env files for standard roles', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'backend-dev', filePath: '.env.local', mode: 'read' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3201'));
});

test('validateFileAccess blocks root-level .pem files', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'backend-dev', filePath: 'server.pem', mode: 'read' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3201'));
});

test('validateFileAccess blocks OrgSpec.json for standard roles', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'backend-dev', filePath: '.ogu/OrgSpec.json', mode: 'write' });
  assert.equal(result.allowed, false);
});

test('validateFileAccess allows privileged role to read .ogu/', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'cto', filePath: '.ogu/STATE.json', mode: 'read' });
  assert.equal(result.allowed, true);
});

test('validateFileAccess: qa has no write scope', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'qa', filePath: 'src/test.ts', mode: 'write' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3202'));
});

test('validateFileAccess: qa can read src/', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'qa', filePath: 'src/app.ts', mode: 'read' });
  assert.equal(result.allowed, true);
});

test('validateFileAccess: qa cannot read outside scope', () => {
  ensureSandboxConfig(TMP);
  const result = validateFileAccess({ root: TMP, roleId: 'qa', filePath: 'tools/internal.mjs', mode: 'read' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3203'));
});

// ── validateToolAccess ──

test('validateToolAccess: qa can use Read', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'qa', toolName: 'Read' });
  assert.equal(result.allowed, true);
});

test('validateToolAccess: qa cannot use Bash', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'qa', toolName: 'Bash' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3204'));
});

test('validateToolAccess: qa cannot use Write', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'qa', toolName: 'Write' });
  assert.equal(result.allowed, false);
});

test('validateToolAccess: backend-dev can use Bash', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'backend-dev', toolName: 'Bash' });
  assert.equal(result.allowed, true);
});

test('validateToolAccess: cto can use any tool (wildcard)', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'cto', toolName: 'DestructiveCommand' });
  assert.equal(result.allowed, true);
});

test('validateToolAccess: unknown tool for backend-dev is blocked', () => {
  ensureSandboxConfig(TMP);
  const result = validateToolAccess({ root: TMP, roleId: 'backend-dev', toolName: 'CustomTool' });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3205'));
});

// ── validateNetworkAccess ──

test('validateNetworkAccess: qa (minimal) has no network access', () => {
  ensureSandboxConfig(TMP);
  const result = validateNetworkAccess({ root: TMP, roleId: 'qa', host: 'localhost', port: 3000 });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3206'));
});

test('validateNetworkAccess: backend-dev can access localhost:3000', () => {
  ensureSandboxConfig(TMP);
  const result = validateNetworkAccess({ root: TMP, roleId: 'backend-dev', host: 'localhost', port: 3000 });
  assert.equal(result.allowed, true);
});

test('validateNetworkAccess: backend-dev cannot access external host', () => {
  ensureSandboxConfig(TMP);
  const result = validateNetworkAccess({ root: TMP, roleId: 'backend-dev', host: 'api.example.com', port: 443 });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('OGU3207'));
});

test('validateNetworkAccess: backend-dev blocked on non-allowed port', () => {
  ensureSandboxConfig(TMP);
  const result = validateNetworkAccess({ root: TMP, roleId: 'backend-dev', host: 'localhost', port: 8080 });
  assert.equal(result.allowed, false);
});

test('validateNetworkAccess: cto (privileged) has full network access', () => {
  ensureSandboxConfig(TMP);
  const result = validateNetworkAccess({ root: TMP, roleId: 'cto', host: 'api.example.com', port: 443 });
  assert.equal(result.allowed, true);
});

// ── validateAccess (legacy) ──

test('validateAccess: deny-all mode blocks everything', () => {
  const result = validateAccess({ filesystem: { mode: 'deny-all' } }, 'src/app.ts');
  assert.equal(result.allowed, false);
});

test('validateAccess: denied paths block matching files', () => {
  const result = validateAccess({ filesystem: { deniedPaths: ['.env'] } }, '.env.local');
  // .env.local starts with .env
  assert.equal(result.allowed, false);
});

test('validateAccess: allowed paths permit matching files', () => {
  const result = validateAccess({ filesystem: { allowedPaths: ['src/'] } }, 'src/app.ts');
  assert.equal(result.allowed, true);
});

test('validateAccess: file outside allowed paths is blocked', () => {
  const result = validateAccess({ filesystem: { allowedPaths: ['src/'] } }, 'tools/cli.mjs');
  assert.equal(result.allowed, false);
});

test('validateAccess: no restrictions allows all', () => {
  const result = validateAccess({ filesystem: {} }, 'anything/goes.ts');
  assert.equal(result.allowed, true);
});

// Cleanup
if (origRoot === undefined) delete process.env.OGU_ROOT;
else process.env.OGU_ROOT = origRoot;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
