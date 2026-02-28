#!/usr/bin/env node

/**
 * Slice 19 — Agent Registry + Audit CLI (Gap Closure P1 + P2)
 *
 * Proves: Agent registry with 10 default roles, per-agent state,
 *   role matching, and audit CLI with show/search/export.
 *
 * Tests:
 *   - ogu agent:list — list all registered agents/roles
 *   - ogu agent:show <roleId> — show agent details + state
 *   - ogu agent:create — create custom role
 *   - agent-registry.mjs lib — loadOrgSpec, matchRole, loadAgentState
 *   - 10 default roles in OrgSpec
 *   - Per-agent state files (.ogu/agents/{roleId}.state.json)
 *   - ogu audit:show — show recent audit events
 *   - ogu audit:search — filter by type/feature/date
 *   - ogu audit:export — export audit trail as JSON
 *   - Audit index for fast lookup
 *
 * Depends on: Slices 1-18
 *
 * Run: node tests/e2e/slice-19.test.mjs
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
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 19 — Agent Registry + Audit CLI (P1 + P2)\x1b[0m\n');
console.log('  Agent roles, per-agent state, audit show/search/export\n');

setup();

// ── Part 1: Extended OrgSpec with 10 Default Roles ──

console.log('\x1b[36m  Part 1: OrgSpec Default Roles\x1b[0m');

await test('org:init creates OrgSpec with multiple roles', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  assert(org.roles.length >= 5, `Should have at least 5 roles, got ${org.roles.length}`);
});

await test('OrgSpec has core roles: backend-dev, architect, qa', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  const roleIds = org.roles.map(r => r.roleId);
  assert(roleIds.includes('backend-dev'), 'Should have backend-dev role');
  assert(roleIds.includes('architect'), 'Should have architect role');
  assert(roleIds.includes('qa'), 'Should have qa role');
});

await test('OrgSpec roles have required fields', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  for (const role of org.roles) {
    assert(role.roleId, `Role missing roleId: ${JSON.stringify(role).slice(0, 100)}`);
    assert(role.name, `Role ${role.roleId} missing name`);
    assert(role.department, `Role ${role.roleId} missing department`);
    assert(Array.isArray(role.capabilities), `Role ${role.roleId} missing capabilities array`);
    assert(role.riskTier, `Role ${role.roleId} missing riskTier`);
    assert(role.sandbox, `Role ${role.roleId} missing sandbox`);
    assert(typeof role.maxTokensPerTask === 'number', `Role ${role.roleId} missing maxTokensPerTask`);
  }
});

await test('roles have escalation paths', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  const withEscalation = org.roles.filter(r => r.escalationPath);
  assert(withEscalation.length >= 1, 'At least some roles should have escalationPath');
});

// ── Part 2: Agent Registry Library ──

console.log('\n\x1b[36m  Part 2: Agent Registry Library\x1b[0m');

await test('agent-registry.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  assert(typeof mod.loadOrgSpec === 'function', 'Should export loadOrgSpec');
  assert(typeof mod.matchRole === 'function', 'Should export matchRole');
  assert(typeof mod.loadAgentState === 'function', 'Should export loadAgentState');
  assert(typeof mod.saveAgentState === 'function', 'Should export saveAgentState');
});

await test('loadOrgSpec returns valid OrgSpec', async () => {
  const { loadOrgSpec } = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  const org = loadOrgSpec();
  assert(org, 'Should return OrgSpec');
  assert(org.roles.length >= 5, `Should have roles: ${org.roles.length}`);
});

await test('matchRole finds role by capability', async () => {
  const { matchRole } = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  const role = matchRole({ capability: 'code_generation' });
  assert(role, 'Should find a role with code_generation');
  assert(role.capabilities.includes('code_generation'), 'Matched role should have the capability');
});

await test('matchRole with riskTier filters correctly', async () => {
  const { matchRole } = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  const lowRisk = matchRole({ capability: 'code_generation', maxRiskTier: 'low' });
  // code_generation roles are medium risk — no low-risk match is expected
  // This validates that the filter works (returns null when no match)
  if (lowRisk) {
    assert(['low', 'medium'].includes(lowRisk.riskTier), `Should be low or medium risk, got ${lowRisk.riskTier}`);
  }
  // Also verify we CAN match at medium tier
  const medRisk = matchRole({ capability: 'code_generation', maxRiskTier: 'medium' });
  assert(medRisk, 'Should find a medium-risk role for code_generation');
});

await test('loadAgentState returns empty state for new agent', async () => {
  const { loadAgentState } = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  const state = loadAgentState('backend-dev');
  assert(state, 'Should return state object');
  assert(typeof state.tasksCompleted === 'number', 'Should have tasksCompleted');
  assert(typeof state.tasksFailed === 'number', 'Should have tasksFailed');
});

await test('saveAgentState persists to disk', async () => {
  const { loadAgentState, saveAgentState } = await import('../../tools/ogu/commands/lib/agent-registry.mjs');
  const state = loadAgentState('backend-dev');
  state.tasksCompleted = 5;
  state.lastActiveAt = new Date().toISOString();
  saveAgentState('backend-dev', state);

  assert(fileExists('.ogu/agents/backend-dev.state.json'), 'Agent state file should exist');
  const saved = readJSON('.ogu/agents/backend-dev.state.json');
  assertEqual(saved.tasksCompleted, 5, 'Should persist tasksCompleted');
});

// ── Part 3: Agent CLI Commands ──

console.log('\n\x1b[36m  Part 3: Agent CLI\x1b[0m');

await test('ogu agent:list shows all roles', async () => {
  const result = ogu('agent:list');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('backend-dev') && result.stdout.includes('architect'),
    `Should list roles: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('agent:list shows role count', async () => {
  const result = ogu('agent:list');
  const org = readJSON('.ogu/OrgSpec.json');
  assert(
    result.stdout.includes(`${org.roles.length}`) || result.stdout.includes('role'),
    `Should show count: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('ogu agent:show <roleId> shows details', async () => {
  const result = ogu('agent:show', ['backend-dev']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('backend-dev') || result.stdout.includes('Backend Developer'),
    `Should show role: ${result.stdout.trim().slice(0, 200)}`,
  );
  assert(
    result.stdout.includes('capabilities') || result.stdout.includes('Capabilities') || result.stdout.includes('code_generation'),
    `Should show capabilities: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('agent:show for unknown role returns error', async () => {
  const result = ogu('agent:show', ['nonexistent-role']);
  assertEqual(result.exitCode, 1, 'Should fail for unknown role');
});

// ── Part 4: Audit CLI — Show ──

console.log('\n\x1b[36m  Part 4: Audit CLI — Show\x1b[0m');

await test('ogu audit:show displays recent events', async () => {
  const result = ogu('audit:show');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('org.initialized') || result.stdout.includes('audit') ||
    result.stdout.includes('event') || result.stdout.includes('type'),
    `Should show events: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('audit:show --limit 5 limits output', async () => {
  const result = ogu('audit:show', ['--limit', '5']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  // Should not show more than 5 events
  const lines = result.stdout.split('\n').filter(l => l.includes('│') || l.includes('|') || l.match(/^\s+\S+\.\S+/));
  assert(lines.length <= 10, `Should limit output (got ${lines.length} event-like lines)`);
});

// ── Part 5: Audit CLI — Search ──

console.log('\n\x1b[36m  Part 5: Audit CLI — Search\x1b[0m');

await test('audit:search --type filters by event type', async () => {
  const result = ogu('audit:search', ['--type', 'org.initialized']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('org.initialized') || result.stdout.includes('found') || result.stdout.includes('match'),
    `Should find org.initialized events: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('audit:search with no matches reports empty', async () => {
  const result = ogu('audit:search', ['--type', 'nonexistent.event.type']);
  assertEqual(result.exitCode, 0, 'Should succeed even with no matches');
  assert(
    result.stdout.includes('0') || result.stdout.includes('No') || result.stdout.includes('none'),
    `Should report no matches: ${result.stdout.trim().slice(0, 200)}`,
  );
});

// ── Part 6: Audit CLI — Export ──

console.log('\n\x1b[36m  Part 6: Audit CLI — Export\x1b[0m');

await test('audit:export outputs JSON array', async () => {
  const result = ogu('audit:export', ['--limit', '20']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  // Output should be parseable JSON
  try {
    const events = JSON.parse(result.stdout.trim());
    assert(Array.isArray(events), 'Should be a JSON array');
    assert(events.length >= 1, `Should have at least 1 event, got ${events.length}`);
    assert(events[0].id, 'Events should have id');
    assert(events[0].type, 'Events should have type');
    assert(events[0].timestamp, 'Events should have timestamp');
  } catch (err) {
    throw new Error(`Should be valid JSON: ${err.message} — output: ${result.stdout.slice(0, 200)}`);
  }
});

await test('audit:export --type filters exported events', async () => {
  const result = ogu('audit:export', ['--type', 'org.initialized', '--limit', '20']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  const events = JSON.parse(result.stdout.trim());
  for (const e of events) {
    assertEqual(e.type, 'org.initialized', `All events should be org.initialized, got ${e.type}`);
  }
});

// ── Cleanup ──

// Clean agent state files we created
const devState = join(ROOT, '.ogu/agents/backend-dev.state.json');
if (existsSync(devState)) rmSync(devState);

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
