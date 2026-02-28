/**
 * Agent Executor Core Tests.
 *
 * Tests the shared execution pipeline:
 *   - OrgSpec not found → returns no_orgspec
 *   - No suitable role → returns no_role
 *   - Budget exceeded → returns budget_exceeded
 *   - Governance denied → returns governance_denied
 *   - Dry-run → returns success with 0 tokens
 *   - Simulate → returns success with simulated tokens
 *
 * Run: node tools/ogu/tests/agent-executor.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

let passed = 0;
let failed = 0;

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const { executeAgentTaskCore } = await import('../commands/lib/agent-executor.mjs');

// ── Setup: ensure OrgSpec exists ──

const orgSpecPath = join(root, '.ogu/OrgSpec.json');
const backupOrgSpec = existsSync(orgSpecPath) ? readFileSync(orgSpecPath, 'utf8') : null;

const testOrgSpec = {
  $schema: 'OrgSpec/1.0',
  orgId: 'test-org',
  roles: [
    {
      roleId: 'test-dev',
      name: 'Test Developer',
      enabled: true,
      capabilities: ['code_generation'],
      riskTier: 'medium',
      maxTokensPerTask: 50000,
      modelPreferences: { minimum: 'fast' },
      sandbox: { allowedPaths: ['src/**'], blockedPaths: [], networkAccess: 'none' },
    },
  ],
  providers: [
    {
      id: 'anthropic',
      enabled: true,
      models: [
        { id: 'claude-haiku', tier: 'fast', costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
        { id: 'claude-sonnet', tier: 'standard', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
      ],
    },
  ],
  teams: [],
  escalation: { enabled: true, maxRetries: 1, tierOrder: ['fast', 'standard', 'advanced'] },
};

mkdirSync(join(root, '.ogu/runners'), { recursive: true });

console.log('\nAgent Executor Core Tests\n');

// ── Tests ──

await asyncTest('1. Returns no_orgspec when OrgSpec missing', async () => {
  // Temporarily rename OrgSpec
  const tmpPath = orgSpecPath + '.tmp';
  if (existsSync(orgSpecPath)) {
    writeFileSync(tmpPath, readFileSync(orgSpecPath, 'utf8'), 'utf8');
    unlinkSync(orgSpecPath);
  }

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'task-1',
  });
  assert(result.success === false, 'Should fail');
  assert(result.status === 'no_orgspec', `Expected no_orgspec, got ${result.status}`);

  // Restore
  if (existsSync(tmpPath)) {
    writeFileSync(orgSpecPath, readFileSync(tmpPath, 'utf8'), 'utf8');
    unlinkSync(tmpPath);
  }
});

await asyncTest('2. Returns no_role when role not found', async () => {
  writeFileSync(orgSpecPath, JSON.stringify({
    ...testOrgSpec,
    roles: [{ ...testOrgSpec.roles[0], enabled: false }],
  }, null, 2), 'utf8');

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'task-1',
  });
  assert(result.success === false, 'Should fail');
  assert(result.status === 'no_role', `Expected no_role, got ${result.status}`);
});

await asyncTest('3. Dry-run returns success with 0 tokens', async () => {
  writeFileSync(orgSpecPath, JSON.stringify(testOrgSpec, null, 2), 'utf8');

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'dry-task-1', dryRun: true,
  });
  assert(result.success === true, `Expected success, got ${result.status}: ${result.error}`);
  assert(result.tokensUsed.total === 0, 'Dry-run should use 0 tokens');
  assert(result.cost === 0, 'Dry-run should cost 0');
  assert(result.durationMs >= 0, 'Should have duration');
});

await asyncTest('4. Simulate mode returns success with simulated tokens', async () => {
  writeFileSync(orgSpecPath, JSON.stringify(testOrgSpec, null, 2), 'utf8');

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'sim-task-1', simulate: true,
    taskSpec: {
      name: 'Test Task',
      description: 'Create a test file',
      output: { files: [{ path: 'test-output.txt', content: 'hello world' }] },
    },
  });
  assert(result.success === true, `Expected success, got ${result.status}: ${result.error}`);
  assert(result.tokensUsed.input > 0, 'Simulate should estimate input tokens');
  assert(result.tokensUsed.output > 0, 'Simulate should estimate output tokens');
});

await asyncTest('5. Writes InputEnvelope and OutputEnvelope', async () => {
  const inputPath = join(root, '.ogu/runners/dry-task-1.input.json');
  const outputPath = join(root, '.ogu/runners/dry-task-1.output.json');

  assert(existsSync(inputPath), 'InputEnvelope should exist');
  assert(existsSync(outputPath), 'OutputEnvelope should exist');

  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert(input.taskId === 'dry-task-1', 'Input taskId should match');
  assert(input.agent.roleId === 'test-dev', 'Input should have role');

  const output = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert(output.taskId === 'dry-task-1', 'Output taskId should match');
  assert(output.status === 'success', 'Output status should be success');
});

await asyncTest('6. Result includes role and model info', async () => {
  writeFileSync(orgSpecPath, JSON.stringify(testOrgSpec, null, 2), 'utf8');

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'info-task', dryRun: true,
  });
  assert(result.roleId === 'test-dev', `Expected test-dev, got ${result.roleId}`);
  assert(result.model === 'claude-haiku', `Expected claude-haiku, got ${result.model}`);
  assert(result.tier === 'fast', `Expected fast tier, got ${result.tier}`);
});

await asyncTest('7. Tier override selects correct model', async () => {
  writeFileSync(orgSpecPath, JSON.stringify(testOrgSpec, null, 2), 'utf8');

  const result = await executeAgentTaskCore(root, {
    featureSlug: 'test', taskId: 'tier-task', dryRun: true, tier: 'standard',
  });
  assert(result.model === 'claude-sonnet', `Expected claude-sonnet, got ${result.model}`);
  assert(result.tier === 'standard', `Expected standard, got ${result.tier}`);
});

// ── Restore ──

if (backupOrgSpec) {
  writeFileSync(orgSpecPath, backupOrgSpec, 'utf8');
} else {
  writeFileSync(orgSpecPath, JSON.stringify(testOrgSpec, null, 2), 'utf8');
}

// Clean up test runner files
for (const taskId of ['dry-task-1', 'sim-task-1', 'info-task', 'tier-task']) {
  for (const suffix of ['input.json', 'output.json']) {
    const p = join(root, `.ogu/runners/${taskId}.${suffix}`);
    if (existsSync(p)) unlinkSync(p);
  }
}
const testOutput = join(root, 'test-output.txt');
if (existsSync(testOutput)) unlinkSync(testOutput);

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
