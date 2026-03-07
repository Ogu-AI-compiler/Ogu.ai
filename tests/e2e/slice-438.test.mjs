/**
 * Slice 438 — Marketplace Slot Assignment Flow
 * Tests assignSlot, checkMinimumSlots, startBuildIfReady, and getSlotSummary.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  assignSlot,
  checkMinimumSlots,
  startBuildIfReady,
  getSlotSummary,
  MINIMUM_REQUIRED_ROLES,
} from '../../tools/ogu/commands/lib/slot-assignment.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 438: Marketplace Slot Assignment Flow ===\n');

const TMP = join(process.cwd(), '.tmp-test-438');
function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}
function cleanup() { rmSync(TMP, { recursive: true, force: true }); }

// Helper: create a marketplace agent on disk
function seedAgent(root, agentId, role, tier = 2, capacityUnits = 20) {
  const agentsDir = join(root, '.ogu', 'marketplace', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  const profile = {
    agent_id: agentId,
    name: `Agent ${agentId}`,
    role,
    role_display: role,
    tier,
    capacity_units: capacityUnits,
    skills: [role],
    specialty: role,
    dna: { work_style: 'methodical' },
    stats: {},
  };
  writeFileSync(join(agentsDir, `${agentId}.json`), JSON.stringify(profile, null, 2), 'utf-8');

  // Update marketplace index
  const idxPath = join(root, '.ogu', 'marketplace', 'index.json');
  let idx = { agents: [], nextId: 1 };
  if (existsSync(idxPath)) {
    try { idx = JSON.parse(readFileSync(idxPath, 'utf-8')); } catch {}
  }
  if (!idx.agents.find(a => a.agent_id === agentId)) {
    idx.agents.push({ agent_id: agentId, name: profile.name, role });
    idx.nextId = idx.agents.length + 1;
  }
  writeFileSync(idxPath, JSON.stringify(idx, null, 2), 'utf-8');

  // Init allocation index
  const allocDir = join(root, '.ogu', 'marketplace', 'allocations');
  mkdirSync(allocDir, { recursive: true });
  const allocIdxPath = join(allocDir, 'index.json');
  if (!existsSync(allocIdxPath)) {
    writeFileSync(allocIdxPath, JSON.stringify({ allocations: [] }, null, 2), 'utf-8');
  }

  return profile;
}

// Helper: create a team.json with unassigned slots
function seedTeam(root, projectId, roles) {
  const dir = join(root, '.ogu', 'projects', projectId);
  mkdirSync(dir, { recursive: true });
  const members = roles.map((r, i) => ({
    member_id: `tm_${String(i + 1).padStart(4, '0')}`,
    role_id: r.role_id,
    role_display: r.role_display || r.role_id,
    agent_id: r.agent_id || null,
    agent_name: r.agent_name || null,
    allocation_id: r.allocation_id || null,
    capacity_units: r.capacity_units || 0,
    allocated_units: r.allocated_units || 0,
    status: r.agent_id ? 'active' : 'unassigned',
    optional: r.optional || false,
  }));
  const team = {
    team_id: `team_test`,
    project_id: projectId,
    created_at: new Date().toISOString(),
    members,
    total_slots: members.length,
    assigned_slots: members.filter(m => m.status === 'active').length,
    unassigned_slots: members.filter(m => m.status === 'unassigned').length,
  };
  writeFileSync(join(dir, 'team.json'), JSON.stringify(team, null, 2), 'utf-8');
  return team;
}

// ── MINIMUM_REQUIRED_ROLES ──────────────────────────────────────────────────

test('MINIMUM_REQUIRED_ROLES is an array of role IDs', () => {
  assert.ok(Array.isArray(MINIMUM_REQUIRED_ROLES));
  assert.ok(MINIMUM_REQUIRED_ROLES.length >= 2);
  assert.ok(MINIMUM_REQUIRED_ROLES.includes('backend_engineer'));
  assert.ok(MINIMUM_REQUIRED_ROLES.includes('architect'));
});

// ── assignSlot ──────────────────────────────────────────────────────────────

test('assignSlot: assigns agent to unassigned member slot', () => {
  setup();
  seedAgent(TMP, 'agent_0001', 'backend_engineer');
  seedTeam(TMP, 'proj1', [
    { role_id: 'backend_engineer' },
    { role_id: 'qa' },
  ]);

  const result = assignSlot(TMP, {
    projectId: 'proj1',
    memberId: 'tm_0001',
    agentId: 'agent_0001',
  });

  assert.ok(result.success);
  assert.equal(result.member.status, 'active');
  assert.equal(result.member.agent_id, 'agent_0001');
  assert.ok(result.member.allocation_id);

  // Verify team.json updated
  const team = JSON.parse(readFileSync(join(TMP, '.ogu/projects/proj1/team.json'), 'utf-8'));
  const member = team.members.find(m => m.member_id === 'tm_0001');
  assert.equal(member.status, 'active');
  assert.equal(member.agent_id, 'agent_0001');
  assert.equal(team.assigned_slots, 1);
  assert.equal(team.unassigned_slots, 1);
  cleanup();
});

test('assignSlot: fails if member already assigned', () => {
  setup();
  seedAgent(TMP, 'agent_0001', 'backend_engineer');
  seedTeam(TMP, 'proj1', [
    { role_id: 'backend_engineer', agent_id: 'agent_0001', status: 'active' },
  ]);

  const result = assignSlot(TMP, {
    projectId: 'proj1',
    memberId: 'tm_0001',
    agentId: 'agent_0001',
  });

  assert.equal(result.success, false);
  assert.ok(result.error.includes('already assigned'));
  cleanup();
});

test('assignSlot: fails if team not found', () => {
  setup();
  const result = assignSlot(TMP, {
    projectId: 'nonexistent',
    memberId: 'tm_0001',
    agentId: 'agent_0001',
  });

  assert.equal(result.success, false);
  assert.ok(result.error.includes('not found'));
  cleanup();
});

test('assignSlot: fails if member ID not found', () => {
  setup();
  seedAgent(TMP, 'agent_0001', 'backend_engineer');
  seedTeam(TMP, 'proj1', [{ role_id: 'backend_engineer' }]);

  const result = assignSlot(TMP, {
    projectId: 'proj1',
    memberId: 'tm_9999',
    agentId: 'agent_0001',
  });

  assert.equal(result.success, false);
  assert.ok(result.error.includes('Member'));
  cleanup();
});

test('assignSlot: fails if agent has insufficient capacity', () => {
  setup();
  seedAgent(TMP, 'agent_0001', 'backend_engineer', 2, 1); // capacity=1
  seedTeam(TMP, 'proj1', [{ role_id: 'backend_engineer' }]);

  const result = assignSlot(TMP, {
    projectId: 'proj1',
    memberId: 'tm_0001',
    agentId: 'agent_0001',
  });

  assert.equal(result.success, false);
  assert.ok(result.error.includes('capacity'));
  cleanup();
});

// ── checkMinimumSlots ───────────────────────────────────────────────────────

test('checkMinimumSlots: returns ready=true when all required roles filled', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', status: 'active' },
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
    { role_id: 'qa', agent_id: 'a3', status: 'active' },
  ]);

  const result = checkMinimumSlots(TMP, 'proj1');
  assert.equal(result.ready, true);
  assert.equal(result.missingRoles.length, 0);
  cleanup();
});

test('checkMinimumSlots: returns ready=false when required roles missing', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect' }, // unassigned
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
    { role_id: 'qa' }, // unassigned
  ]);

  const result = checkMinimumSlots(TMP, 'proj1');
  assert.equal(result.ready, false);
  assert.ok(result.missingRoles.includes('architect'));
  cleanup();
});

test('checkMinimumSlots: ignores optional unassigned slots', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', status: 'active' },
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
    { role_id: 'designer', optional: true }, // optional, unassigned
  ]);

  const result = checkMinimumSlots(TMP, 'proj1');
  assert.equal(result.ready, true);
  cleanup();
});

test('checkMinimumSlots: returns ready=false if no team', () => {
  setup();
  const result = checkMinimumSlots(TMP, 'nonexistent');
  assert.equal(result.ready, false);
  cleanup();
});

// ── getSlotSummary ──────────────────────────────────────────────────────────

test('getSlotSummary: returns counts and member details', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', agent_name: 'Arch Agent', status: 'active' },
    { role_id: 'backend_engineer' },
    { role_id: 'qa' },
  ]);

  const summary = getSlotSummary(TMP, 'proj1');
  assert.equal(summary.totalSlots, 3);
  assert.equal(summary.assignedSlots, 1);
  assert.equal(summary.unassignedSlots, 2);
  assert.equal(summary.members.length, 3);
  assert.equal(summary.members[0].status, 'active');
  assert.equal(summary.members[1].status, 'unassigned');
  cleanup();
});

test('getSlotSummary: returns empty summary if no team', () => {
  setup();
  const summary = getSlotSummary(TMP, 'nonexistent');
  assert.equal(summary.totalSlots, 0);
  assert.equal(summary.members.length, 0);
  cleanup();
});

// ── startBuildIfReady ───────────────────────────────────────────────────────

test('startBuildIfReady: returns ready=true with enriched plan present', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', status: 'active' },
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
  ]);
  // Create enriched plan
  const planDir = join(TMP, '.ogu/projects/proj1');
  writeFileSync(join(planDir, 'plan.enriched.json'), JSON.stringify({
    projectId: 'proj1',
    tasks: [{ id: 't1', type: 'code', dependsOn: [] }],
  }, null, 2), 'utf-8');

  const result = startBuildIfReady(TMP, 'proj1');
  assert.equal(result.ready, true);
  assert.equal(result.taskCount, 1);
  assert.ok(!result.error);
  cleanup();
});

test('startBuildIfReady: returns ready=false if minimum slots not met', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect' }, // unassigned
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
  ]);

  const result = startBuildIfReady(TMP, 'proj1');
  assert.equal(result.ready, false);
  assert.ok(result.missingRoles.length > 0);
  cleanup();
});

test('startBuildIfReady: returns ready=false if no enriched plan', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', status: 'active' },
    { role_id: 'backend_engineer', agent_id: 'a2', status: 'active' },
  ]);

  const result = startBuildIfReady(TMP, 'proj1');
  assert.equal(result.ready, false);
  assert.ok(result.error.includes('plan'));
  cleanup();
});

test('startBuildIfReady: returns assignedAgents list', () => {
  setup();
  seedTeam(TMP, 'proj1', [
    { role_id: 'architect', agent_id: 'a1', agent_name: 'Alice', status: 'active' },
    { role_id: 'backend_engineer', agent_id: 'a2', agent_name: 'Bob', status: 'active' },
    { role_id: 'designer', optional: true },
  ]);
  const planDir = join(TMP, '.ogu/projects/proj1');
  writeFileSync(join(planDir, 'plan.enriched.json'), JSON.stringify({
    projectId: 'proj1',
    tasks: [{ id: 't1' }, { id: 't2' }],
  }, null, 2), 'utf-8');

  const result = startBuildIfReady(TMP, 'proj1');
  assert.equal(result.ready, true);
  assert.equal(result.assignedAgents.length, 2);
  assert.ok(result.assignedAgents.some(a => a.agentId === 'a1'));
  assert.ok(result.assignedAgents.some(a => a.agentId === 'a2'));
  assert.equal(result.taskCount, 2);
  cleanup();
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
cleanup();
process.exit(failed > 0 ? 1 : 0);
