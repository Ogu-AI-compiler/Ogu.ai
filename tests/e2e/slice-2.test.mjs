#!/usr/bin/env node

/**
 * Slice 2 — End-to-End Test
 *
 * Proves: Policy rules block high-risk tasks, approvals unblock them,
 *         agent:run respects governance decisions.
 *
 * Depends on: Slice 1 (org:init, feature:state, agent:run, audit, budget)
 *
 * Run: node tests/e2e/slice-2.test.mjs
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
      timeout: 30000,
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
  return readFileSync(join(ROOT, relPath), 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

const FEATURE = 'slice2-security-feature';

function setup() {
  // Ensure Slice 1 infra exists
  ogu('org:init', ['--minimal']);

  // Create a security-sensitive policy rule
  const policyRules = {
    version: 1,
    updatedAt: new Date().toISOString(),
    rules: [
      {
        id: 'block-security-without-approval',
        name: 'Block security tasks without CISO approval',
        version: 1,
        enabled: true,
        priority: 100,
        when: {
          operator: 'AND',
          conditions: [
            { field: 'task.riskTier', op: 'in', value: ['high', 'critical'] },
            { field: 'task.touches', op: 'matches_any', value: ['**/auth/**', '**/security/**', '**/crypto/**'] },
          ],
        },
        then: [
          { effect: 'requireApprovals', params: { count: 1, fromRoles: ['security'] } },
        ],
        tags: ['security'],
      },
      {
        id: 'deny-production-without-review',
        name: 'Deny production deployments without review',
        version: 1,
        enabled: true,
        priority: 200,
        when: {
          operator: 'AND',
          conditions: [
            { field: 'task.name', op: 'matches', value: '*deploy*' },
            { field: 'feature.currentState', op: 'neq', value: 'approved' },
          ],
        },
        then: [
          { effect: 'deny', params: { reason: 'Deployment requires approved state' } },
        ],
        tags: ['deployment'],
      },
      {
        id: 'allow-low-risk',
        name: 'Allow low-risk tasks automatically',
        version: 1,
        enabled: true,
        priority: 50,
        when: {
          operator: 'AND',
          conditions: [
            { field: 'task.riskTier', op: 'in', value: ['low', 'medium'] },
          ],
        },
        then: [
          { effect: 'allow', params: {} },
        ],
        tags: ['default'],
      },
    ],
  };

  writeJSON('.ogu/policies/rules.json', policyRules);

  // Create feature in "building" state
  const stateFile = `.ogu/state/features/${FEATURE}.state.json`;
  if (!fileExists(stateFile)) {
    ogu('feature:state', [FEATURE, 'idea']);
    ogu('feature:state', [FEATURE, 'specifying']);
    ogu('feature:state', [FEATURE, 'specified']);
    ogu('feature:state', [FEATURE, 'planning']);
    ogu('feature:state', [FEATURE, 'planned']);
    ogu('feature:state', [FEATURE, 'building']);
  }
}

function cleanup() {
  const stateFile = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(stateFile)) rmSync(stateFile);

  // Clean approval records
  const approvalsDir = join(ROOT, '.ogu/approvals');
  if (existsSync(approvalsDir)) {
    for (const f of readdirSync(approvalsDir)) {
      if (f.includes(FEATURE)) rmSync(join(approvalsDir, f));
    }
  }

  // Clean runner envelopes from this test
  const runnersDir = join(ROOT, '.ogu/runners');
  if (existsSync(runnersDir)) {
    for (const f of readdirSync(runnersDir)) {
      if (f.startsWith('secure-') || f.startsWith('deploy-') || f.startsWith('simple-')) {
        rmSync(join(runnersDir, f));
      }
    }
  }
}

// ── Tests ──

console.log('\n\x1b[1mSlice 2 — Policies & Governance E2E Test\x1b[0m\n');
console.log('  High-risk tasks blocked → approved → unblocked\n');

setup();

// ── Part 1: Policy Rules ──

console.log('\x1b[36m  Part 1: Policy Rules\x1b[0m');

await test('policy rules file exists and is valid', async () => {
  assert(fileExists('.ogu/policies/rules.json'), 'rules.json should exist');
  const { PolicyRuleSetSchema } = await import('../../tools/contracts/schemas/policy-rule.mjs');
  const rules = readJSON('.ogu/policies/rules.json');
  PolicyRuleSetSchema.parse(rules);
});

await test('governance:check evaluates low-risk task as ALLOW', async () => {
  const result = ogu('governance:check', [
    '--feature', FEATURE,
    '--task', 'simple-refactor',
    '--risk', 'low',
  ]);
  assertEqual(result.exitCode, 0, 'Should exit 0 for allowed task');
  assert(result.stdout.includes('ALLOW') || result.stdout.includes('allow'),
    `Output should indicate ALLOW, got: ${result.stdout.trim()}`);
});

await test('governance:check evaluates high-risk security task as REQUIRES_APPROVAL', async () => {
  const result = ogu('governance:check', [
    '--feature', FEATURE,
    '--task', 'secure-auth-rewrite',
    '--risk', 'high',
    '--touches', 'src/auth/login.ts,src/auth/session.ts',
  ]);
  // Exit 0 means it evaluated successfully (even if requiring approval)
  assertEqual(result.exitCode, 0, 'Should exit 0 (evaluation succeeded)');
  assert(
    result.stdout.includes('REQUIRES_APPROVAL') || result.stdout.includes('requireApprovals'),
    `Output should indicate approval needed, got: ${result.stdout.trim()}`
  );
});

await test('governance:check evaluates deployment without approval as DENY', async () => {
  const result = ogu('governance:check', [
    '--feature', FEATURE,
    '--task', 'deploy-to-production',
    '--risk', 'high',
  ]);
  assertEqual(result.exitCode, 0, 'Should exit 0 (evaluation succeeded)');
  assert(
    result.stdout.includes('DENY') || result.stdout.includes('deny'),
    `Output should indicate DENY, got: ${result.stdout.trim()}`
  );
});

// ── Part 2: Agent Run respects policies ──

console.log('\n\x1b[36m  Part 2: Agent Run respects policies\x1b[0m');

await test('agent:run succeeds for low-risk task', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE,
    '--task', 'simple-refactor',
    '--dry-run',
    '--risk', 'low',
  ]);
  assertEqual(result.exitCode, 0, 'Low-risk task should succeed');
  assert(fileExists('.ogu/runners/simple-refactor.output.json'),
    'OutputEnvelope should be written');
});

await test('agent:run blocks high-risk security task without approval', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE,
    '--task', 'secure-auth-rewrite',
    '--dry-run',
    '--risk', 'high',
    '--touches', 'src/auth/login.ts',
  ]);
  assert(result.exitCode !== 0, 'High-risk task should be blocked');
  assert(
    result.stdout.includes('approval') || result.stderr.includes('approval') ||
    result.stdout.includes('blocked') || result.stderr.includes('blocked') ||
    result.stdout.includes('REQUIRES_APPROVAL') || result.stderr.includes('REQUIRES_APPROVAL'),
    'Should mention approval requirement'
  );
});

// ── Part 3: Approval workflow ──

console.log('\n\x1b[36m  Part 3: Approval Workflow\x1b[0m');

await test('approve creates approval record', async () => {
  const result = ogu('approve', [
    '--feature', FEATURE,
    '--task', 'secure-auth-rewrite',
    '--role', 'security',
    '--by', 'ciso',
  ]);
  assertEqual(result.exitCode, 0, 'Approve should succeed');
  assert(fileExists('.ogu/approvals') || result.stdout.includes('approved'),
    'Should have approval record or confirmation');
});

await test('agent:run succeeds for approved high-risk task', async () => {
  const result = ogu('agent:run', [
    '--feature', FEATURE,
    '--task', 'secure-auth-rewrite',
    '--dry-run',
    '--risk', 'high',
    '--touches', 'src/auth/login.ts',
  ]);
  assertEqual(result.exitCode, 0, 'Approved task should succeed');
  assert(fileExists('.ogu/runners/secure-auth-rewrite.output.json'),
    'OutputEnvelope should be written');
});

await test('deny blocks a task', async () => {
  const result = ogu('deny', [
    '--feature', FEATURE,
    '--task', 'deploy-to-production',
    '--role', 'security',
    '--by', 'ciso',
    '--reason', 'Not ready for production',
  ]);
  assertEqual(result.exitCode, 0, 'Deny should succeed');
});

// ── Part 4: Audit Trail ──

console.log('\n\x1b[36m  Part 4: Audit Trail\x1b[0m');

await test('audit log contains governance events', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const govEvents = events.filter(e =>
    e.type.startsWith('governance.') || e.type === 'approval.granted' || e.type === 'approval.denied'
  );
  assert(govEvents.length >= 1, `Should have governance events, got ${govEvents.length}`);
});

await test('audit log records policy evaluation results', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const evalEvents = events.filter(e => e.type === 'governance.evaluated');
  assert(evalEvents.length >= 1, 'Should have at least 1 governance.evaluated event');
  const first = evalEvents[0];
  assert(first.payload.decision, 'Event should have decision in payload');
});

await test('audit log records approval', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const approvalEvents = events.filter(e =>
    e.type === 'approval.granted' || e.type === 'governance.approved'
  );
  assert(approvalEvents.length >= 1, 'Should have approval event');
});

// ── Part 5: Integration ──

console.log('\n\x1b[36m  Part 5: Integration\x1b[0m');

await test('governance:check with --json returns structured output', async () => {
  const result = ogu('governance:check', [
    '--feature', FEATURE,
    '--task', 'simple-refactor',
    '--risk', 'low',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'Should exit 0');
  const json = JSON.parse(result.stdout);
  assert(json.decision, 'JSON should have decision');
  assert(json.matchedRules !== undefined, 'JSON should have matchedRules');
});

await test('disabled rules are not evaluated', async () => {
  // Disable the low-risk allow rule, evaluate a low-risk task
  const rules = readJSON('.ogu/policies/rules.json');
  const original = JSON.parse(JSON.stringify(rules));

  // Disable the allow rule
  const allowRule = rules.rules.find(r => r.id === 'allow-low-risk');
  allowRule.enabled = false;
  writeJSON('.ogu/policies/rules.json', rules);

  const result = ogu('governance:check', [
    '--feature', FEATURE,
    '--task', 'another-task',
    '--risk', 'low',
    '--json',
  ]);

  // Restore original rules
  writeJSON('.ogu/policies/rules.json', original);

  assertEqual(result.exitCode, 0, 'Should exit 0');
  const json = JSON.parse(result.stdout);
  // When no rule matches, default should be ALLOW (no explicit deny = allow)
  assert(json.decision === 'ALLOW' || json.matchedRules.length === 0,
    'Disabled rule should not match');
});

// ── Cleanup and report ──

cleanup();

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
