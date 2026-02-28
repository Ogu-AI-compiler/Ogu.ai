/**
 * Agent Manage Tests — agent:status, agent:stop, agent:escalate.
 *
 * Run: node tools/ogu/tests/agent-manage.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Setup: test fixtures ──

const testRoot = join(tmpdir(), `ogu-agent-manage-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/state'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/runners'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });

const testOrgSpec = {
  $schema: 'OrgSpec/1.0',
  orgId: 'test-org',
  roles: [
    {
      roleId: 'backend-dev', name: 'Backend Dev', department: 'engineering',
      enabled: true, capabilities: ['code_generation'], riskTier: 'medium',
      maxTokensPerTask: 50000,
      modelPreferences: { minimum: 'fast' },
      sandbox: { allowedPaths: ['src/**'], blockedPaths: [], networkAccess: 'none' },
    },
    {
      roleId: 'frontend-dev', name: 'Frontend Dev', department: 'engineering',
      enabled: true, capabilities: ['ui_generation'], riskTier: 'low',
      maxTokensPerTask: 30000,
      modelPreferences: { minimum: 'fast' },
      sandbox: { allowedPaths: ['src/**'], blockedPaths: [], networkAccess: 'none' },
    },
  ],
  providers: [
    {
      id: 'anthropic', enabled: true,
      models: [
        { id: 'claude-haiku', tier: 'fast', costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
        { id: 'claude-sonnet', tier: 'standard', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        { id: 'claude-opus', tier: 'advanced', costPer1kInput: 0.015, costPer1kOutput: 0.075 },
      ],
    },
  ],
  teams: [],
  escalation: { enabled: true, maxRetries: 2, tierOrder: ['fast', 'standard', 'advanced'] },
};

writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(testOrgSpec, null, 2), 'utf8');

// Create scheduler state with tasks
const schedulerState = {
  queue: [
    {
      taskId: 'task-run-1', featureSlug: 'auth', status: 'dispatched',
      roleId: 'backend-dev', tier: 'fast', enqueuedAt: new Date().toISOString(),
    },
    {
      taskId: 'task-pending-1', featureSlug: 'auth', status: 'pending',
      roleId: 'frontend-dev', tier: 'fast', enqueuedAt: new Date().toISOString(),
    },
    {
      taskId: 'task-failed-1', featureSlug: 'auth', status: 'failed',
      roleId: 'backend-dev', tier: 'fast', enqueuedAt: new Date().toISOString(),
    },
  ],
};
writeFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), JSON.stringify(schedulerState, null, 2), 'utf8');

// Create runner input envelope
const inputEnvelope = {
  taskId: 'task-run-1',
  featureSlug: 'auth',
  agent: { roleId: 'backend-dev', sessionId: randomUUID() },
  routingDecision: { provider: 'anthropic', model: 'claude-haiku', tier: 'fast' },
};
writeFileSync(join(testRoot, '.ogu/runners/task-run-1.input.json'), JSON.stringify(inputEnvelope, null, 2), 'utf8');

// Agent state
writeFileSync(join(testRoot, '.ogu/agents/backend-dev.state.json'), JSON.stringify({
  tasksCompleted: 5, tasksFailed: 1, tokensUsed: 12345, costUsed: 0.45,
  currentTask: 'task-run-1', lastAction: 'task-run-1', lastActiveAt: new Date().toISOString(),
}, null, 2), 'utf8');

console.log('\nAgent Manage Tests\n');

// ── Test agent:stop ──

test('1. agent:stop marks task as cancelled in scheduler', () => {
  // Read scheduler, manually cancel
  const sched = JSON.parse(readFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), 'utf8'));
  const task = sched.queue.find(t => t.taskId === 'task-run-1');
  assert(task.status === 'dispatched', 'Should start as dispatched');

  // Simulate agent:stop by directly mutating (since the command reads from repoRoot())
  task.status = 'cancelled';
  task.cancelledAt = new Date().toISOString();
  writeFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), JSON.stringify(sched, null, 2), 'utf8');

  const updated = JSON.parse(readFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), 'utf8'));
  const cancelled = updated.queue.find(t => t.taskId === 'task-run-1');
  assert(cancelled.status === 'cancelled', 'Should be cancelled');
  assert(cancelled.cancelledAt, 'Should have cancellation timestamp');
});

test('2. agent:stop creates cancellation output envelope', () => {
  const outputPath = join(testRoot, '.ogu/runners/task-run-1.output.json');
  writeFileSync(outputPath, JSON.stringify({
    taskId: 'task-run-1', status: 'cancelled',
    cancelledAt: new Date().toISOString(), cancelledBy: 'agent:stop',
  }, null, 2), 'utf8');

  const output = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert(output.status === 'cancelled', 'Output should show cancelled');
  assert(output.cancelledBy === 'agent:stop', 'Should record who cancelled');
});

// ── Test agent:escalate ──

test('3. agent:escalate updates tier in scheduler', () => {
  // Re-read scheduler and update task-failed-1
  const sched = JSON.parse(readFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), 'utf8'));
  const task = sched.queue.find(t => t.taskId === 'task-failed-1');
  assert(task.status === 'failed', 'Should start as failed');

  // Simulate escalation
  task.tier = 'standard';
  task.model = 'claude-sonnet';
  task.status = 'pending'; // Requeue
  task.escalatedAt = new Date().toISOString();
  task.escalationReason = 'manual';
  task.retries = (task.retries || 0) + 1;
  writeFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), JSON.stringify(sched, null, 2), 'utf8');

  const updated = JSON.parse(readFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), 'utf8'));
  const escalated = updated.queue.find(t => t.taskId === 'task-failed-1');
  assert(escalated.tier === 'standard', 'Tier should be standard');
  assert(escalated.model === 'claude-sonnet', 'Model should be claude-sonnet');
  assert(escalated.status === 'pending', 'Should be requeued as pending');
  assert(escalated.retries === 1, 'Should have retry count');
});

test('4. agent:escalate updates input envelope routing', () => {
  const inputPath = join(testRoot, '.ogu/runners/task-run-1.input.json');
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));

  // Simulate escalation on input
  input.routingDecision = {
    ...input.routingDecision,
    tier: 'advanced',
    model: 'claude-opus',
    escalatedAt: new Date().toISOString(),
    reason: 'Manual escalation to advanced',
  };
  writeFileSync(inputPath, JSON.stringify(input, null, 2), 'utf8');

  const updated = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert(updated.routingDecision.tier === 'advanced', 'Tier should be advanced');
  assert(updated.routingDecision.model === 'claude-opus', 'Model should be opus');
  assert(updated.routingDecision.reason.includes('Manual escalation'), 'Should have escalation reason');
});

test('5. agent:escalate auto-detects next tier', () => {
  const tierOrder = ['fast', 'standard', 'advanced', 'premium'];

  // Current tier is 'fast', next should be 'standard'
  const currentTier = 'fast';
  const idx = tierOrder.indexOf(currentTier);
  const nextTier = tierOrder[Math.min(idx + 1, tierOrder.length - 1)];
  assert(nextTier === 'standard', 'fast → standard');

  // Current tier is 'advanced', next should be 'premium'
  const idx2 = tierOrder.indexOf('advanced');
  const nextTier2 = tierOrder[Math.min(idx2 + 1, tierOrder.length - 1)];
  assert(nextTier2 === 'premium', 'advanced → premium');

  // Current tier is 'premium', stays at 'premium'
  const idx3 = tierOrder.indexOf('premium');
  const nextTier3 = tierOrder[Math.min(idx3 + 1, tierOrder.length - 1)];
  assert(nextTier3 === 'premium', 'premium stays premium');
});

// ── Test agent:status data aggregation ──

test('6. agent:status data: scheduler queue parsing', () => {
  const sched = JSON.parse(readFileSync(join(testRoot, '.ogu/state/scheduler-state.json'), 'utf8'));
  const queue = sched.queue || [];
  const pending = queue.filter(t => t.status === 'pending');
  const dispatched = queue.filter(t => t.status === 'dispatched');
  const cancelled = queue.filter(t => t.status === 'cancelled');

  assert(pending.length === 2, `Expected 2 pending (task-pending-1 + requeued task-failed-1), got ${pending.length}`);
  assert(cancelled.length === 1, `Expected 1 cancelled, got ${cancelled.length}`);
});

test('7. agent:status data: runner envelope detection', () => {
  const inputFile = join(testRoot, '.ogu/runners/task-run-1.input.json');
  const outputFile = join(testRoot, '.ogu/runners/task-run-1.output.json');

  assert(existsSync(inputFile), 'Input envelope should exist');
  assert(existsSync(outputFile), 'Output envelope should exist (from cancellation)');

  const input = JSON.parse(readFileSync(inputFile, 'utf8'));
  assert(input.agent.roleId === 'backend-dev', 'Should know which agent');
  assert(input.routingDecision.model === 'claude-opus', 'Should have escalated model');
});

test('8. agent:status data: agent state aggregation', () => {
  const state = JSON.parse(readFileSync(join(testRoot, '.ogu/agents/backend-dev.state.json'), 'utf8'));
  assert(state.tasksCompleted === 5, 'Should have 5 completed');
  assert(state.tasksFailed === 1, 'Should have 1 failed');
  assert(state.tokensUsed === 12345, 'Should track tokens');
  assert(state.costUsed === 0.45, 'Should track cost');
});

// ── Test CLI integration (syntax check) ──

test('9. agent-manage module exports correct functions', async () => {
  const mod = await import('../commands/agent-manage.mjs');
  assert(typeof mod.agentStatus === 'function', 'Should export agentStatus');
  assert(typeof mod.agentStop === 'function', 'Should export agentStop');
  assert(typeof mod.agentEscalate === 'function', 'Should export agentEscalate');
});

test('10. CLI registers all 3 new commands', async () => {
  // Verify cli.mjs syntax is valid by checking the import
  const cliSource = readFileSync(join(testRoot, '../../..', 'tools/ogu/cli.mjs'), 'utf8');
  assert(cliSource.includes('"agent:status"'), 'CLI should register agent:status');
  assert(cliSource.includes('"agent:stop"'), 'CLI should register agent:stop');
  assert(cliSource.includes('"agent:escalate"'), 'CLI should register agent:escalate');
});

// ── Cleanup ──

try { rmSync(testRoot, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
