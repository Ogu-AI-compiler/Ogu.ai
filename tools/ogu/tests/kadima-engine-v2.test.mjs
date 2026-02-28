/**
 * Kadima Engine v2 Tests.
 *
 * 10 tests covering:
 *   Section 1: initKadimaFromOrgSpec (3 tests)
 *   Section 2: allocatePlan (3 tests)
 *   Section 3: generateStandup (2 tests)
 *   Section 4: getSystemStatus (2 tests)
 */

import {
  initKadimaFromOrgSpec, allocatePlan, generateStandup,
  getSystemStatus, loadAllocations, saveAllocations, createKadimaEngine,
} from '../commands/lib/kadima-engine.mjs';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

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

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-kadima-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/state'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  mkdirSync(join(root, '.ogu/agents'), { recursive: true });
  mkdirSync(join(root, '.ogu/budget'), { recursive: true });
  // Write OrgSpec with 10 roles
  writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify({
    defaults: { model: 'claude-sonnet-4-20250514' },
    roles: [
      { roleId: 'cto', enabled: true, capabilities: ['override', 'governance'], maxConcurrent: 1 },
      { roleId: 'tech-lead', enabled: true, capabilities: ['architecture', 'code-review'], maxConcurrent: 2 },
      { roleId: 'pm', enabled: true, capabilities: ['product', 'writing'], maxConcurrent: 1 },
      { roleId: 'architect', enabled: true, capabilities: ['architecture', 'design'], maxConcurrent: 1 },
      { roleId: 'backend-dev', enabled: true, capabilities: ['code-gen', 'implementation'], maxConcurrent: 3 },
      { roleId: 'frontend-dev', enabled: true, capabilities: ['code-gen', 'ui', 'design'], maxConcurrent: 3 },
      { roleId: 'qa', enabled: true, capabilities: ['testing', 'qa'], maxConcurrent: 2 },
      { roleId: 'devops', enabled: true, capabilities: ['deployment'], maxConcurrent: 1 },
      { roleId: 'designer', enabled: true, capabilities: ['design', 'ui'], maxConcurrent: 1 },
      { roleId: 'security', enabled: true, capabilities: ['validation', 'testing'], maxConcurrent: 1 },
    ],
    teams: [{ teamId: 'core', roles: ['backend-dev', 'frontend-dev'] }],
  }), 'utf8');
  // Write model-config for router
  writeFileSync(join(root, '.ogu/model-config.json'), JSON.stringify({
    tiers: { fast: { models: ['haiku'] }, standard: { models: ['sonnet'] }, premium: { models: ['opus'] } },
    roleDefaults: {},
  }), 'utf8');
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: initKadimaFromOrgSpec
// ═══════════════════════════════════════════════════════════════════════

// 1. initKadimaFromOrgSpec returns engine, spec, and roles
{
  const root = makeTmpRoot();
  const result = initKadimaFromOrgSpec(root);
  assert(result.engine && result.spec && Array.isArray(result.roles),
    'initKadimaFromOrgSpec returns engine + spec + roles');
  rmSync(root, { recursive: true, force: true });
}

// 2. All 10 enabled roles are registered
{
  const root = makeTmpRoot();
  const result = initKadimaFromOrgSpec(root);
  assert(result.roles.length === 10, 'All 10 roles registered');
  rmSync(root, { recursive: true, force: true });
}

// 3. In-memory engine works
{
  const engine = createKadimaEngine();
  engine.registerAgent('dev', { capabilities: ['code-gen'], maxConcurrent: 2 });
  const alloc = engine.assignTask({ taskId: 'T1', requiredCapabilities: ['code-gen'] });
  assert(alloc && alloc.agentId === 'dev', 'In-memory engine assigns tasks correctly');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: allocatePlan
// ═══════════════════════════════════════════════════════════════════════

// 4. allocatePlan assigns tasks to roles
{
  const root = makeTmpRoot();
  const tasks = [
    { id: 'T1', phase: 'build', capabilities: ['code-gen'] },
    { id: 'T2', phase: 'verify', capabilities: ['testing'] },
  ];
  const results_ = allocatePlan(tasks, { root, featureSlug: 'test' });
  assert(results_.length === 2 && results_[0].roleId && results_[1].roleId,
    'allocatePlan assigns roles to all tasks');
  rmSync(root, { recursive: true, force: true });
}

// 5. allocatePlan skips already-allocated tasks
{
  const root = makeTmpRoot();
  const tasks = [{ id: 'T1', phase: 'build' }];
  allocatePlan(tasks, { root, featureSlug: 'test' });
  // Allocate same task again
  const results_ = allocatePlan(tasks, { root, featureSlug: 'test' });
  assert(results_.length === 1 && results_[0].taskId === 'T1',
    'allocatePlan returns existing allocation for duplicate tasks');
  rmSync(root, { recursive: true, force: true });
}

// 6. allocatePlan persists to disk
{
  const root = makeTmpRoot();
  allocatePlan([{ id: 'T1', phase: 'build' }], { root, featureSlug: 'test' });
  const loaded = loadAllocations(root);
  assert(loaded.length >= 1 && loaded.some(a => a.taskId === 'T1'),
    'allocatePlan persists allocations to disk');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: generateStandup
// ═══════════════════════════════════════════════════════════════════════

// 7. generateStandup returns structured output
{
  const root = makeTmpRoot();
  const standup = generateStandup(root);
  assert(standup.date && standup.allocations && standup.agents && standup.summary,
    'generateStandup returns date, allocations, agents, summary');
  rmSync(root, { recursive: true, force: true });
}

// 8. generateStandup includes budget info
{
  const root = makeTmpRoot();
  const standup = generateStandup(root);
  assert(standup.budget !== undefined, 'generateStandup includes budget info');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: getSystemStatus
// ═══════════════════════════════════════════════════════════════════════

// 9. getSystemStatus returns all expected keys
{
  const root = makeTmpRoot();
  const status = getSystemStatus(root);
  const hasAllKeys = ['healthy', 'issues', 'orgSpec', 'agents', 'allocations', 'budget', 'events', 'worktrees']
    .every(k => k in status);
  assert(hasAllKeys, 'getSystemStatus returns all expected keys');
  rmSync(root, { recursive: true, force: true });
}

// 10. getSystemStatus detects stale allocations
{
  const root = makeTmpRoot();
  // Create a stale allocation (48h old)
  saveAllocations(root, [{
    taskId: 'stale-1', roleId: 'backend-dev', status: 'active',
    assignedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
  }]);
  const status = getSystemStatus(root);
  assert(status.allocations.stale >= 1, 'getSystemStatus detects stale allocations');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nKadima Engine v2 Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
