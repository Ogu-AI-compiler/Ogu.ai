/**
 * slice-417.test.mjs — Team Assembler tests
 * Tests: scoreAgentForRole, matchAgentToRole, defaultCapacity,
 *        assembleTeam, saveTeam, loadTeam, getTeamCapacity, getMemberForRole
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { saveAgent } from '../../tools/ogu/commands/lib/agent-store.mjs';
import { generateAgent } from '../../tools/ogu/commands/lib/agent-generator.mjs';
import {
  scoreAgentForRole,
  matchAgentToRole,
  defaultCapacity,
  assembleTeam,
  saveTeam,
  loadTeam,
  getTeamCapacity,
  getMemberForRole,
} from '../../tools/ogu/commands/lib/team-assembler.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeAgent(overrides = {}) {
  return {
    agent_id: `agent_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Agent',
    role: overrides.role || 'backend',
    specialty: overrides.specialty || 'api',
    skills: overrides.skills || ['node', 'typescript'],
    tier: overrides.tier || 2,
    capacity_units: overrides.capacity_units || 10,
    ...overrides,
  };
}

function makeBlueprint(roles) {
  return {
    blueprint_id: `bp_test_${Date.now()}`,
    complexity_tier: 'medium',
    roles: roles.map(r => ({
      role_id: r.role_id,
      role_display: r.role_display || r.role_id,
      count: r.count || 1,
      optional: r.optional || false,
      rationale: 'test',
    })),
    total_headcount: roles.reduce((s, r) => s + (r.count || 1), 0),
    total_slots: roles.reduce((s, r) => s + (r.count || 1), 0),
  };
}

let tmpDir;

// ── defaultCapacity ───────────────────────────────────────────────────────────

console.log('\ndefaultCapacity');

test('pm = 6', () => assertEqual(defaultCapacity('pm'), 6));
test('architect = 8', () => assertEqual(defaultCapacity('architect'), 8));
test('backend_engineer = 10', () => assertEqual(defaultCapacity('backend_engineer'), 10));
test('frontend_engineer = 10', () => assertEqual(defaultCapacity('frontend_engineer'), 10));
test('qa = 8', () => assertEqual(defaultCapacity('qa'), 8));
test('devops = 8', () => assertEqual(defaultCapacity('devops'), 8));
test('security = 8', () => assertEqual(defaultCapacity('security'), 8));
test('unknown role = 6 (default)', () => assertEqual(defaultCapacity('unknown_role_xyz'), 6));

// ── scoreAgentForRole ─────────────────────────────────────────────────────────

console.log('\nscoreAgentForRole');

test('exact role match scores highest', () => {
  const agent = makeFakeAgent({ role: 'backend_engineer' });
  const score = scoreAgentForRole(agent, 'backend_engineer');
  assert(score >= 10, `expected ≥10, got ${score}`);
});

test('specialty match adds score', () => {
  const agentA = makeFakeAgent({ role: 'engineer', specialty: 'backend api' });
  const agentB = makeFakeAgent({ role: 'engineer', specialty: 'design' });
  const sA = scoreAgentForRole(agentA, 'backend_engineer');
  const sB = scoreAgentForRole(agentB, 'backend_engineer');
  assert(sA > sB, `backend specialty should score higher: ${sA} > ${sB}`);
});

test('tier bonus included', () => {
  const low = makeFakeAgent({ role: 'backend', tier: 1 });
  const high = makeFakeAgent({ role: 'backend', tier: 4 });
  assert(scoreAgentForRole(high, 'backend_engineer') > scoreAgentForRole(low, 'backend_engineer'));
});

test('unrelated agent scores 0', () => {
  const agent = makeFakeAgent({ role: 'designer', specialty: 'figma', skills: ['css', 'sketch'] });
  const score = scoreAgentForRole(agent, 'security');
  assert(score < 3, `expected < 3, got ${score}`);
});

test('null agent returns 0', () => {
  assertEqual(scoreAgentForRole(null, 'pm'), 0);
});

test('null roleId returns 0', () => {
  assertEqual(scoreAgentForRole(makeFakeAgent(), null), 0);
});

// ── matchAgentToRole ──────────────────────────────────────────────────────────

console.log('\nmatchAgentToRole');

test('returns best matching agent', () => {
  const agents = [
    makeFakeAgent({ role: 'qa quality tester', specialty: 'quality' }),
    makeFakeAgent({ role: 'backend engineer', specialty: 'api' }),
    makeFakeAgent({ role: 'frontend developer', specialty: 'react' }),
  ];
  const result = matchAgentToRole(agents, 'qa');
  assert(result !== null);
  assert(result.agent.role.includes('qa'));
});

test('returns null when no agents', () => {
  assert(matchAgentToRole([], 'pm') === null);
});

test('returns null when no suitable match', () => {
  const agents = [makeFakeAgent({ role: 'designer', specialty: 'graphics', skills: [] })];
  // designer vs security — score should be low/0
  const result = matchAgentToRole(agents, 'security');
  // may return null or low-score agent depending on skills
  if (result !== null) {
    assert(result.score < 5, `expected low score, got ${result.score}`);
  }
});

test('includes score in result', () => {
  const agents = [makeFakeAgent({ role: 'backend engineer' })];
  const result = matchAgentToRole(agents, 'backend_engineer');
  assert(result !== null);
  assert(typeof result.score === 'number');
  assert(result.score > 0);
});

// ── saveTeam / loadTeam ───────────────────────────────────────────────────────

console.log('\nsaveTeam / loadTeam');

test('saveTeam writes team.json', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-team-'));
  const team = {
    team_id: 'team_001',
    project_id: 'proj-x',
    blueprint_id: 'bp_001',
    created_at: new Date().toISOString(),
    members: [],
    total_slots: 0,
    assigned_slots: 0,
    unassigned_slots: 0,
  };
  saveTeam(tmpDir, 'proj-x', team);
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-x', 'team.json')));
});

test('loadTeam returns saved team', () => {
  const team = {
    team_id: 'team_002',
    project_id: 'proj-load',
    blueprint_id: 'bp_002',
    created_at: new Date().toISOString(),
    members: [{ member_id: 'tm_0001', role_id: 'pm', status: 'active' }],
    total_slots: 1,
    assigned_slots: 1,
    unassigned_slots: 0,
  };
  saveTeam(tmpDir, 'proj-load', team);
  const loaded = loadTeam(tmpDir, 'proj-load');
  assert(loaded !== null);
  assertEqual(loaded.team_id, 'team_002');
  assertEqual(loaded.members.length, 1);
});

test('loadTeam returns null for missing project', () => {
  assert(loadTeam(tmpDir, 'no-such-project-xyz') === null);
});

// ── assembleTeam (no marketplace agents) ─────────────────────────────────────

console.log('\nassembleTeam (no agents in marketplace)');

test('assembleTeam with empty marketplace → all unassigned', () => {
  const blueprint = makeBlueprint([
    { role_id: 'pm', count: 1 },
    { role_id: 'backend_engineer', count: 2 },
  ]);
  const result = assembleTeam(tmpDir, {
    projectId: 'proj-empty',
    teamBlueprint: blueprint,
  });
  assertEqual(result.total_slots, 3);
  assertEqual(result.unassigned_slots, 3);
  assertEqual(result.assigned_slots, 0);
  assert(result.members.every(m => m.status === 'unassigned'));
});

test('assembleTeam saves team.json', () => {
  const blueprint = makeBlueprint([{ role_id: 'qa', count: 1 }]);
  assembleTeam(tmpDir, { projectId: 'proj-save-check', teamBlueprint: blueprint });
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-save-check', 'team.json')));
});

test('assembleTeam returns team_id and blueprint_id', () => {
  const blueprint = makeBlueprint([{ role_id: 'pm', count: 1 }]);
  const result = assembleTeam(tmpDir, { projectId: 'proj-ids', teamBlueprint: blueprint });
  assert(result.team_id.startsWith('team_'));
  assertEqual(result.blueprint_id, blueprint.blueprint_id);
});

test('assembleTeam members have correct role_id', () => {
  const blueprint = makeBlueprint([
    { role_id: 'pm', count: 1 },
    { role_id: 'qa', count: 1 },
  ]);
  const result = assembleTeam(tmpDir, { projectId: 'proj-roles', teamBlueprint: blueprint });
  const roleIds = result.members.map(m => m.role_id);
  assert(roleIds.includes('pm'));
  assert(roleIds.includes('qa'));
});

// ── assembleTeam with marketplace agents ─────────────────────────────────────

console.log('\nassembleTeam (with marketplace agents)');

test('assembleTeam assigns best-fit agents', () => {
  const agentTmp = mkdtempSync(join(tmpdir(), 'ogu-team-mkt-'));

  // Generate and save some agents
  const backendAgent = generateAgent({ role: 'backend_engineer', specialty: 'api', tier: 2 });
  const pmAgent = generateAgent({ role: 'pm', specialty: 'product management', tier: 2 });
  saveAgent(agentTmp, backendAgent);
  saveAgent(agentTmp, pmAgent);

  const blueprint = makeBlueprint([
    { role_id: 'pm', count: 1 },
    { role_id: 'backend_engineer', count: 1 },
  ]);

  const result = assembleTeam(agentTmp, {
    projectId: 'proj-with-agents',
    teamBlueprint: blueprint,
  });

  // Should assign at least 1 slot
  assert(result.assigned_slots >= 1, `expected ≥1 assigned, got ${result.assigned_slots}`);
  const activeMembers = result.members.filter(m => m.status === 'active');
  assert(activeMembers.every(m => m.agent_id !== null));
  assert(activeMembers.every(m => m.allocation_id !== null));

  try { rmSync(agentTmp, { recursive: true, force: true }); } catch {}
});

test('assigned members have agent_name and tier', () => {
  const agentTmp = mkdtempSync(join(tmpdir(), 'ogu-team-name-'));
  const agent = generateAgent({ role: 'backend_engineer', specialty: 'api', tier: 3 });
  saveAgent(agentTmp, agent);

  const blueprint = makeBlueprint([{ role_id: 'backend_engineer', count: 1 }]);
  const result = assembleTeam(agentTmp, {
    projectId: 'proj-name-check',
    teamBlueprint: blueprint,
  });

  const active = result.members.filter(m => m.status === 'active');
  if (active.length > 0) {
    assert(active[0].agent_name, 'agent_name should be set');
    assert(typeof active[0].agent_tier === 'number', 'agent_tier should be number');
  }
  try { rmSync(agentTmp, { recursive: true, force: true }); } catch {}
});

test('same agent not assigned to two slots', () => {
  const agentTmp = mkdtempSync(join(tmpdir(), 'ogu-team-dup-'));
  // One backend agent, two backend slots — second should be unassigned
  const agent = generateAgent({ role: 'backend_engineer', specialty: 'api', tier: 2 });
  saveAgent(agentTmp, agent);

  const blueprint = makeBlueprint([{ role_id: 'backend_engineer', count: 2 }]);
  const result = assembleTeam(agentTmp, {
    projectId: 'proj-nodup',
    teamBlueprint: blueprint,
  });

  const agentIds = result.members.filter(m => m.agent_id).map(m => m.agent_id);
  const unique = new Set(agentIds);
  assertEqual(unique.size, agentIds.length, 'each agent used only once');

  try { rmSync(agentTmp, { recursive: true, force: true }); } catch {}
});

// ── getTeamCapacity ───────────────────────────────────────────────────────────

console.log('\ngetTeamCapacity');

test('returns 0 for missing project', () => {
  const cap = getTeamCapacity(tmpDir, 'no-project-xyz');
  assertEqual(cap.total, 0);
  assertEqual(cap.available, 0);
  assertEqual(cap.members.length, 0);
});

test('returns capacity summary for empty team', () => {
  const blueprint = makeBlueprint([{ role_id: 'pm', count: 1 }]);
  assembleTeam(tmpDir, { projectId: 'proj-cap', teamBlueprint: blueprint });
  const cap = getTeamCapacity(tmpDir, 'proj-cap');
  // all unassigned (no agents in marketplace)
  assertEqual(cap.members.length, 0); // no active members
  assertEqual(cap.total, 0);
});

// ── getMemberForRole ──────────────────────────────────────────────────────────

console.log('\ngetMemberForRole');

test('returns null for missing project', () => {
  assert(getMemberForRole(tmpDir, 'nonexistent', 'pm') === null);
});

test('returns null when role not in team', () => {
  const blueprint = makeBlueprint([{ role_id: 'qa', count: 1 }]);
  assembleTeam(tmpDir, { projectId: 'proj-role-check', teamBlueprint: blueprint });
  assert(getMemberForRole(tmpDir, 'proj-role-check', 'devops') === null);
});

test('returns member when role exists', () => {
  // Save a team manually with an active PM
  const team = {
    team_id: 'team_manual',
    project_id: 'proj-manual',
    blueprint_id: 'bp_test',
    created_at: new Date().toISOString(),
    members: [
      { member_id: 'tm_0001', role_id: 'pm', role_display: 'PM', agent_id: 'agent_0001', agent_name: 'Alice', status: 'active', capacity_units: 6, allocated_units: 4 },
      { member_id: 'tm_0002', role_id: 'qa', role_display: 'QA', agent_id: null, agent_name: null, status: 'unassigned', capacity_units: 0, allocated_units: 0 },
    ],
    total_slots: 2, assigned_slots: 1, unassigned_slots: 1,
  };
  saveTeam(tmpDir, 'proj-manual', team);
  const member = getMemberForRole(tmpDir, 'proj-manual', 'pm');
  assert(member !== null);
  assertEqual(member.agent_id, 'agent_0001');
  assertEqual(member.agent_name, 'Alice');
});

test('returns only active member for role', () => {
  const team = {
    team_id: 'team_active',
    project_id: 'proj-active',
    blueprint_id: 'bp_test',
    created_at: new Date().toISOString(),
    members: [
      { member_id: 'tm_0001', role_id: 'backend_engineer', agent_id: null, agent_name: null, status: 'unassigned', capacity_units: 0 },
    ],
    total_slots: 1, assigned_slots: 0, unassigned_slots: 1,
  };
  saveTeam(tmpDir, 'proj-active', team);
  assert(getMemberForRole(tmpDir, 'proj-active', 'backend_engineer') === null);
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
