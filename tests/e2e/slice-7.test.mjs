#!/usr/bin/env node

/**
 * Slice 7 — Multi-Agent Runtime E2E Test
 *
 * Proves:
 *   1. Multiple agent roles (developer, reviewer, security) defined in OrgSpec
 *   2. Tasks are routed to the correct agent role based on capabilities
 *   3. Agents share context via a shared context store
 *   4. Handoff protocol: agent A's output becomes agent B's input context
 *   5. Session management: each agent run gets a unique session
 *
 * Scenario:
 *   Feature "auth-module" has 3 tasks:
 *     task-1: developer writes auth code
 *     task-2: reviewer reviews developer's code (depends on task-1)
 *     task-3: security audits the code (depends on task-1)
 *
 * Depends on: Slices 1-6
 *
 * Run: node tests/e2e/slice-7.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');

function ogu(command, args = []) {
  const allArgs = [CLI, command, ...args];
  try {
    const output = execFileSync('node', allArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSONL(relPath) {
  const fp = join(ROOT, relPath);
  if (!existsSync(fp)) return [];
  return readFileSync(fp, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

const FEATURE = 'slice7-multi-agent';

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  // Add multiple agent roles to OrgSpec
  const orgSpec = readJSON('.ogu/OrgSpec.json');
  orgSpec.roles = [
    {
      roleId: 'developer',
      name: 'Developer',
      description: 'Writes code',
      department: 'engineering',
      capabilities: ['code_generation', 'testing'],
      riskTier: 'medium',
      enabled: true,
      modelPreferences: { minimum: 'standard' },
      maxTokensPerTask: 100000,
      sandbox: { allowedPaths: ['src/**'], blockedPaths: [], networkAccess: 'none' },
    },
    {
      roleId: 'reviewer',
      name: 'Code Reviewer',
      description: 'Reviews code for quality and correctness',
      department: 'engineering',
      capabilities: ['review', 'code_generation'],
      riskTier: 'low',
      enabled: true,
      modelPreferences: { minimum: 'standard' },
      maxTokensPerTask: 50000,
      sandbox: { allowedPaths: ['src/**', 'docs/**'], blockedPaths: [], networkAccess: 'none' },
    },
    {
      roleId: 'security',
      name: 'Security Auditor',
      description: 'Audits code for security vulnerabilities',
      department: 'security',
      capabilities: ['security_audit', 'review'],
      riskTier: 'high',
      enabled: true,
      modelPreferences: { minimum: 'advanced' },
      maxTokensPerTask: 80000,
      sandbox: { allowedPaths: ['src/**', 'docs/**'], blockedPaths: [], networkAccess: 'none' },
    },
  ];
  writeJSON('.ogu/OrgSpec.json', orgSpec);

  // Clean previous feature state
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);

  // Clean shared context
  const contextDir = join(ROOT, `.ogu/context/${FEATURE}`);
  if (existsSync(contextDir)) rmSync(contextDir, { recursive: true });

  // Clean sessions — remove all sessions for this feature by reading contents
  const sessionsDir = join(ROOT, '.ogu/sessions');
  if (existsSync(sessionsDir)) {
    for (const f of readdirSync(sessionsDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const s = JSON.parse(readFileSync(join(sessionsDir, f), 'utf8'));
        if (s.featureSlug === FEATURE) rmSync(join(sessionsDir, f));
      } catch { /* skip */ }
    }
  }

  // Reset budget
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 0, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 0, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });
}

// ── Tests ──

console.log('\n\x1b[1mSlice 7 — Multi-Agent Runtime E2E Test\x1b[0m\n');
console.log('  Developer → Reviewer + Security Auditor (parallel after dev)\n');

setup();

// ── Part 1: Multi-Role OrgSpec ──

console.log('\x1b[36m  Part 1: Multi-Role OrgSpec\x1b[0m');

await test('OrgSpec has 3 agent roles', async () => {
  const orgSpec = readJSON('.ogu/OrgSpec.json');
  assertEqual(orgSpec.roles.length, 3, 'Should have 3 roles');
  assert(orgSpec.roles.find(r => r.roleId === 'developer'), 'Should have developer');
  assert(orgSpec.roles.find(r => r.roleId === 'reviewer'), 'Should have reviewer');
  assert(orgSpec.roles.find(r => r.roleId === 'security'), 'Should have security');
});

await test('each role has distinct capabilities', async () => {
  const orgSpec = readJSON('.ogu/OrgSpec.json');
  const dev = orgSpec.roles.find(r => r.roleId === 'developer');
  const sec = orgSpec.roles.find(r => r.roleId === 'security');
  assert(dev.capabilities.includes('code_generation'), 'Developer should have code_generation');
  assert(sec.capabilities.includes('security_audit'), 'Security should have security_audit');
  assert(!dev.capabilities.includes('security_audit'), 'Developer should NOT have security_audit');
});

// ── Part 2: Role-Based Task Routing ──

console.log('\n\x1b[36m  Part 2: Role-Based Task Routing\x1b[0m');

await test('agent:run routes to developer role', async () => {
  ogu('feature:state', [FEATURE, 'idea']);

  const result = ogu('agent:run', [
    '--feature', FEATURE, '--task', 'write-auth-code',
    '--role', 'developer', '--dry-run',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed with developer role');
  assert(result.stdout.includes('developer') || result.stdout.includes('Developer'), 'Should use developer role');
});

await test('agent:run routes to reviewer role', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE, '--task', 'review-auth-code',
    '--role', 'reviewer', '--dry-run',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed with reviewer role');
  assert(result.stdout.includes('reviewer') || result.stdout.includes('Reviewer'), 'Should use reviewer role');
});

await test('agent:run routes to security role', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE, '--task', 'audit-auth-code',
    '--role', 'security', '--dry-run',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed with security role');
  assert(result.stdout.includes('security') || result.stdout.includes('Security'), 'Should use security role');
});

// ── Part 3: Shared Context Store ──

console.log('\n\x1b[36m  Part 3: Shared Context Store\x1b[0m');

await test('context:write stores data for a feature', async () => {
  const result = ogu('context:write', [
    '--feature', FEATURE,
    '--key', 'developer.output',
    '--value', '{"files":["src/auth/login.mjs"],"summary":"Implemented login flow"}',
  ]);
  assertEqual(result.exitCode, 0, 'context:write should exit 0');
});

await test('context:read retrieves stored data', async () => {
  const result = ogu('context:read', [
    '--feature', FEATURE,
    '--key', 'developer.output',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'context:read should exit 0');
  const data = JSON.parse(result.stdout);
  assert(data.files && data.files.includes('src/auth/login.mjs'), 'Should contain developer output');
});

await test('context:list shows all keys for a feature', async () => {
  // Write another context entry
  ogu('context:write', [
    '--feature', FEATURE,
    '--key', 'reviewer.comments',
    '--value', '{"approved":true,"comments":["LGTM"]}',
  ]);

  const result = ogu('context:list', ['--feature', FEATURE, '--json']);
  assertEqual(result.exitCode, 0, 'context:list should exit 0');
  const keys = JSON.parse(result.stdout);
  assert(keys.includes('developer.output'), 'Should list developer.output');
  assert(keys.includes('reviewer.comments'), 'Should list reviewer.comments');
});

// ── Part 4: Handoff Protocol ──

console.log('\n\x1b[36m  Part 4: Handoff Protocol\x1b[0m');

await test('agent:run with --context reads shared context', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE, '--task', 'review-with-context',
    '--role', 'reviewer', '--dry-run',
    '--context', 'developer.output',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed reading handoff context');
  assert(
    result.stdout.includes('context loaded') || result.stdout.includes('handoff') || result.stdout.includes('developer.output'),
    `Should confirm context was loaded: ${result.stdout.trim()}`
  );
});

await test('handoff context included in InputEnvelope', async () => {
  const input = readJSON('.ogu/runners/review-with-context.input.json');
  assert(input.relevantHistory || input.handoffContext, 'InputEnvelope should include handoff context');
});

// ── Part 5: Session Management ──

console.log('\n\x1b[36m  Part 5: Session Management\x1b[0m');

await test('each agent:run creates a session record', async () => {
  const result = ogu('session:list', ['--feature', FEATURE, '--json']);
  assertEqual(result.exitCode, 0, 'session:list should exit 0');
  const sessions = JSON.parse(result.stdout);
  assert(sessions.length >= 1, `Should have at least 1 session, got ${sessions.length}`);
});

await test('sessions track role and task', async () => {
  const result = ogu('session:list', ['--feature', FEATURE, '--json']);
  const sessions = JSON.parse(result.stdout);
  const devSession = sessions.find(s => s.roleId === 'developer');
  assert(devSession, 'Should have a developer session');
  assert(devSession.taskId, 'Session should have taskId');
});

// ── Part 6: Audit Trail ──

console.log('\n\x1b[36m  Part 6: Multi-Agent Audit Trail\x1b[0m');

await test('audit trail shows different roles executing tasks', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const runs = events.filter(e =>
    e.type === 'runner.completed' && e.payload?.featureSlug === FEATURE
  );
  assert(runs.length >= 3, `Should have at least 3 runner.completed events, got ${runs.length}`);
});

await test('audit trail has context.write events', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const writes = events.filter(e =>
    e.type === 'context.write' && e.payload?.featureSlug === FEATURE
  );
  assert(writes.length >= 2, `Should have at least 2 context.write events, got ${writes.length}`);
});

await test('audit trail shows handoff from developer to reviewer', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const handoff = events.find(e =>
    e.type === 'agent.handoff' && e.payload?.featureSlug === FEATURE
  );
  assert(handoff, 'Should have handoff audit event');
  assertEqual(handoff.payload.fromRole, 'developer', 'Handoff should be from developer');
  assertEqual(handoff.payload.toRole, 'reviewer', 'Handoff should be to reviewer');
});

// ── Cleanup ──

const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
if (existsSync(featureState)) rmSync(featureState);

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
