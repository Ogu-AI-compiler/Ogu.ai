/**
 * slice-421.test.mjs — Project Lifecycle Pipeline tests
 * Tests: launchProjectPipeline, readProjectData (full pipeline integration)
 * All tests use simulate=true — no LLM required.
 */

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  launchProjectPipeline,
  readProjectData,
  getExecutionState,
} from '../../tools/ogu/commands/lib/project-executor.mjs';
import { loadCTOPlan } from '../../tools/ogu/commands/lib/cto-planner.mjs';
import { loadTeam } from '../../tools/ogu/commands/lib/team-assembler.mjs';
import { loadPRD } from '../../tools/ogu/commands/lib/pm-engine.mjs';
import { loadPlan } from '../../tools/ogu/commands/lib/task-enricher.mjs';

let passed = 0;
let failed = 0;

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

let tmpDir;

// ── launchProjectPipeline ─────────────────────────────────────────────────────

console.log('\nlaunchProjectPipeline');

await testAsync('returns result with required fields', async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-launch-'));
  const result = await launchProjectPipeline(tmpDir, 'proj-basic', 'A simple portfolio website', { simulate: true });
  assert(result.projectId === 'proj-basic');
  assert(typeof result.tier === 'string', 'tier required');
  assert(typeof result.teamSize === 'number', 'teamSize required');
  assert(typeof result.features === 'number', 'features required');
  assert(typeof result.tasks === 'number', 'tasks required');
  assert(result.ready === true);
});

await testAsync('saves cto-plan.json to .ogu/projects/{id}/', async () => {
  await launchProjectPipeline(tmpDir, 'proj-cto-save', 'A basic todo app', { simulate: true });
  const plan = loadCTOPlan(tmpDir, 'proj-cto-save');
  assert(plan !== null, 'cto-plan.json should exist');
  assert(plan.project_id === 'proj-cto-save', `expected project_id='proj-cto-save', got '${plan.project_id}'`);
});

await testAsync('saves team.json', async () => {
  await launchProjectPipeline(tmpDir, 'proj-team-save', 'A basic blog', { simulate: true });
  const team = loadTeam(tmpDir, 'proj-team-save');
  assert(team !== null, 'team.json should exist');
  assert(Array.isArray(team.members), 'team.members should be array');
  assert(team.members.length > 0, 'team should have members');
});

await testAsync('saves prd.json', async () => {
  await launchProjectPipeline(tmpDir, 'proj-prd-save', 'A simple portfolio website', { simulate: true });
  const prd = loadPRD(tmpDir, 'proj-prd-save');
  assert(prd !== null, 'prd.json should exist');
  assert(Array.isArray(prd.features), 'prd.features should be array');
  assert(prd.features.length > 0, 'prd should have features');
});

await testAsync('saves plan.enriched.json', async () => {
  await launchProjectPipeline(tmpDir, 'proj-enriched-save', 'A landing page', { simulate: true });
  const plan = loadPlan(tmpDir, 'proj-enriched-save');
  assert(plan !== null, 'plan.enriched.json should exist');
  assert(plan._enrichment !== undefined, 'plan should have _enrichment metadata');
});

await testAsync('medium complexity has larger team than low', async () => {
  const low = await launchProjectPipeline(tmpDir, 'proj-low', 'A portfolio website', { simulate: true });
  const medium = await launchProjectPipeline(tmpDir, 'proj-med', 'A web app with user auth and database and admin dashboard', { simulate: true });
  assert(medium.teamSize >= low.teamSize, `medium(${medium.teamSize}) should >= low(${low.teamSize})`);
});

await testAsync('creates .ogu/projects/{id}/ directory', async () => {
  await launchProjectPipeline(tmpDir, 'proj-dir-check', 'A basic app', { simulate: true });
  const dir = join(tmpDir, '.ogu', 'projects', 'proj-dir-check');
  assert(existsSync(dir), 'project directory should exist');
});

await testAsync('pipeline is deterministic for same brief', async () => {
  const brief = 'A deterministic test portfolio website';
  const r1 = await launchProjectPipeline(tmpDir, 'proj-det-1', brief, { simulate: true });
  const r2 = await launchProjectPipeline(tmpDir, 'proj-det-2', brief, { simulate: true });
  assertEqual(r1.tier, r2.tier, 'tier should be same');
  assertEqual(r1.teamSize, r2.teamSize, 'teamSize should be same');
  assertEqual(r1.features, r2.features, 'features should be same');
});

// ── readProjectData (post-launch) ─────────────────────────────────────────────

console.log('\nreadProjectData (post-launch)');

await testAsync('readProjectData returns all artifacts after launch', async () => {
  await launchProjectPipeline(tmpDir, 'proj-read-all', 'A task manager with auth', { simulate: true });
  const data = readProjectData(tmpDir, 'proj-read-all');
  assert(data !== null);
  assert(data.ctoPlan !== null, 'ctoPlan should be present');
  assert(data.team !== null, 'team should be present');
  assert(data.prd !== null, 'prd should be present');
  assert(data.enrichedPlan !== null, 'enrichedPlan should be present');
  assert(data.executionState === null, 'executionState should be null (not run yet)');
});

await testAsync('readProjectData ctoPlan has complexity with tier', async () => {
  await launchProjectPipeline(tmpDir, 'proj-read-cto', 'A simple website', { simulate: true });
  const data = readProjectData(tmpDir, 'proj-read-cto');
  assert(data.ctoPlan.complexity !== undefined, 'ctoPlan.complexity required');
  assert(data.ctoPlan.complexity.tier !== undefined, 'ctoPlan.complexity.tier required');
});

await testAsync('readProjectData prd has features with priorities', async () => {
  await launchProjectPipeline(tmpDir, 'proj-read-prd', 'A web app with auth', { simulate: true });
  const data = readProjectData(tmpDir, 'proj-read-prd');
  assert(data.prd.features.length > 0, 'prd should have features');
  const priorities = new Set(data.prd.features.map(f => f.priority));
  assert(priorities.has('must'), 'should have must-have features');
});

await testAsync('readProjectData enrichedPlan tasks have owner_role', async () => {
  await launchProjectPipeline(tmpDir, 'proj-read-tasks', 'A basic app', { simulate: true });
  const data = readProjectData(tmpDir, 'proj-read-tasks');
  if (data.enrichedPlan.tasks.length > 0) {
    const t = data.enrichedPlan.tasks[0];
    assert(t.owner_role !== undefined, 'enriched task should have owner_role');
    assert(t.definition_of_done !== undefined, 'enriched task should have definition_of_done');
    assert(Array.isArray(t.gates), 'enriched task should have gates array');
  }
});

await testAsync('readProjectData returns null for non-existent project', async () => {
  const data = readProjectData(tmpDir, 'no-such-project-xyz');
  assert(data === null);
});

await testAsync('getExecutionState returns null before run', async () => {
  await launchProjectPipeline(tmpDir, 'proj-prerun', 'A basic app', { simulate: true });
  const state = getExecutionState(tmpDir, 'proj-prerun');
  assert(state === null, 'execution state should not exist before run');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

await new Promise(r => setTimeout(r, 100));

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
