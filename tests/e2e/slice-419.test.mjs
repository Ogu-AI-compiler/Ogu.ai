/**
 * slice-419.test.mjs — Task Graph enrichment tests
 * Tests: normalizeRole, mapTaskToFeature, buildDefinitionOfDone, inferGates,
 *        enrichTask, enrichPlan, validateEnrichedTask, savePlan, loadPlan
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normalizeRole,
  mapTaskToFeature,
  buildDefinitionOfDone,
  inferGates,
  enrichTask,
  enrichPlan,
  validateEnrichedTask,
  savePlan,
  loadPlan,
} from '../../tools/ogu/commands/lib/task-enricher.mjs';

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: 'feat-auth',
    title: 'User Authentication',
    description: 'Login and account management',
    priority: 'must',
    acceptance_criteria: [
      'User can register with email and password',
      'User can login with valid credentials',
      'Session persists across page refreshes',
    ],
  },
  {
    id: 'feat-payment',
    title: 'Payment Processing',
    description: 'Stripe payment integration',
    priority: 'must',
    acceptance_criteria: [
      'User can enter payment details',
      'Successful payment shows confirmation',
    ],
  },
  {
    id: 'feat-dashboard',
    title: 'Admin Dashboard',
    description: 'Admin reporting and management',
    priority: 'should',
    acceptance_criteria: ['Admin can view metrics'],
  },
];

const MOCK_PRD = {
  meta: { version: '1.0', created_at: new Date().toISOString() },
  product: { name: 'TestApp', one_liner: 'A test app', target_users: 'users', primary_value: 'value' },
  features: FEATURES,
  data_entities: [],
  integrations: [],
  non_functional: { performance: 'fast', security: 'secure', reliability: 'reliable', observability: 'visible' },
  out_of_scope: [],
  success_metrics: [],
  assumptions: [],
  open_questions: [],
};

const MOCK_TEAM = {
  team_id: 'team_001',
  project_id: 'proj-test',
  members: [
    { member_id: 'tm_0001', role_id: 'backend_engineer', agent_id: 'agent_0042', agent_name: 'Alice', status: 'active' },
    { member_id: 'tm_0002', role_id: 'pm', agent_id: 'agent_0007', agent_name: 'Bob', status: 'active' },
    { member_id: 'tm_0003', role_id: 'qa', agent_id: null, agent_name: null, status: 'unassigned' },
  ],
};

function makeTask(overrides = {}) {
  return {
    id: 'task-001',
    name: 'Create user login endpoint',
    description: 'Implement POST /auth/login endpoint with JWT',
    requiredRole: 'developer',
    inputs: [],
    outputs: ['src/api/auth.ts'],
    dependsOn: [],
    ...overrides,
  };
}

function makePlan(tasks) {
  return {
    featureSlug: 'test-feature',
    version: 1,
    tasks,
  };
}

// ── normalizeRole ─────────────────────────────────────────────────────────────

console.log('\nnormalizeRole');

test('developer → backend_engineer', () => assertEqual(normalizeRole('developer'), 'backend_engineer'));
test('backend → backend_engineer', () => assertEqual(normalizeRole('backend'), 'backend_engineer'));
test('backend-dev → backend_engineer', () => assertEqual(normalizeRole('backend-dev'), 'backend_engineer'));
test('frontend → frontend_engineer', () => assertEqual(normalizeRole('frontend'), 'frontend_engineer'));
test('frontend-dev → frontend_engineer', () => assertEqual(normalizeRole('frontend-dev'), 'frontend_engineer'));
test('pm → pm', () => assertEqual(normalizeRole('pm'), 'pm'));
test('product-manager → pm', () => assertEqual(normalizeRole('product-manager'), 'pm'));
test('qa → qa', () => assertEqual(normalizeRole('qa'), 'qa'));
test('architect → architect', () => assertEqual(normalizeRole('architect'), 'architect'));
test('tech-lead → architect', () => assertEqual(normalizeRole('tech-lead'), 'architect'));
test('devops → devops', () => assertEqual(normalizeRole('devops'), 'devops'));
test('security → security', () => assertEqual(normalizeRole('security'), 'security'));
test('null → backend_engineer default', () => assertEqual(normalizeRole(null), 'backend_engineer'));
test('empty → backend_engineer default', () => assertEqual(normalizeRole(''), 'backend_engineer'));
test('unknown role preserved lowercased', () => {
  const r = normalizeRole('CustomRole');
  assert(typeof r === 'string' && r.length > 0);
});

// ── mapTaskToFeature ──────────────────────────────────────────────────────────

console.log('\nmapTaskToFeature');

test('auth task → feat-auth', () => {
  const task = makeTask({ name: 'Create login endpoint', description: 'User authentication with JWT' });
  assertEqual(mapTaskToFeature(task, FEATURES), 'feat-auth');
});

test('payment task → feat-payment', () => {
  const task = makeTask({ name: 'Stripe payment integration', description: 'Process billing payments' });
  assertEqual(mapTaskToFeature(task, FEATURES), 'feat-payment');
});

test('admin task → feat-dashboard', () => {
  const task = makeTask({ name: 'Build admin dashboard', description: 'Admin metrics and reporting' });
  assertEqual(mapTaskToFeature(task, FEATURES), 'feat-dashboard');
});

test('unrelated task → falls back to first feature', () => {
  const task = makeTask({ name: 'Setup CI pipeline', description: 'Configure GitHub Actions' });
  const result = mapTaskToFeature(task, FEATURES);
  assert(typeof result === 'string' && result.startsWith('feat-'));
});

test('empty features → null', () => {
  assert(mapTaskToFeature(makeTask(), []) === null);
});

test('returns feature id (not title)', () => {
  const task = makeTask({ name: 'User authentication flow', description: 'Login and register' });
  const result = mapTaskToFeature(task, FEATURES);
  assert(result.startsWith('feat-'), `expected feat- prefix, got ${result}`);
});

// ── buildDefinitionOfDone ─────────────────────────────────────────────────────

console.log('\nbuildDefinitionOfDone');

test('returns non-empty string', () => {
  const dod = buildDefinitionOfDone(makeTask(), FEATURES[0]);
  assert(typeof dod === 'string' && dod.length > 0);
});

test('includes output file path', () => {
  const task = makeTask({ outputs: ['src/api/auth.ts'] });
  const dod = buildDefinitionOfDone(task, null);
  assert(dod.includes('src/api/auth.ts'), `DoD should mention output file: ${dod}`);
});

test('includes relevant AC from feature', () => {
  const task = makeTask({ name: 'login endpoint', description: 'user can login with credentials' });
  const dod = buildDefinitionOfDone(task, FEATURES[0]);
  assert(dod.length > 20, `DoD too short: ${dod}`);
});

test('works with no feature', () => {
  const dod = buildDefinitionOfDone(makeTask(), null);
  assert(dod.length > 0);
});

test('works with no outputs', () => {
  const task = makeTask({ outputs: [], inputs: [] });
  const dod = buildDefinitionOfDone(task, FEATURES[0]);
  assert(dod.length > 0);
});

// ── inferGates ────────────────────────────────────────────────────────────────

console.log('\ninferGates');

test('TypeScript output → type-check gate', () => {
  const task = makeTask({ outputs: ['src/auth.ts'] });
  assert(inferGates(task).includes('type-check'));
});

test('test file → tests-pass gate', () => {
  const task = makeTask({ outputs: ['src/auth.test.ts'] });
  assert(inferGates(task).includes('tests-pass'));
});

test('migration file → migration-runs gate', () => {
  const task = makeTask({ outputs: ['src/migrations/001_users.ts'] });
  const gates = inferGates(task);
  assert(gates.includes('migration-runs') || gates.includes('type-check'));
});

test('JS file → no-syntax-error gate', () => {
  const task = makeTask({ outputs: ['lib/util.mjs'] });
  assert(inferGates(task).includes('no-syntax-error'));
});

test('no outputs → output-exists gate', () => {
  const task = makeTask({ outputs: [] });
  assert(inferGates(task).includes('output-exists'));
});

test('returns array', () => {
  assert(Array.isArray(inferGates(makeTask())));
});

test('existing gates not overridden if present', () => {
  const task = makeTask({ gates: ['custom-gate'], outputs: ['src/auth.ts'] });
  // enrichTask should preserve existing gates
  const enriched = enrichTask(task, { prd: MOCK_PRD, team: MOCK_TEAM });
  assert(enriched.gates.includes('custom-gate'), 'existing gates should be preserved');
});

// ── enrichTask ────────────────────────────────────────────────────────────────

console.log('\nenrichTask');

test('adds feature_id', () => {
  const task = makeTask({ name: 'user login', description: 'auth login' });
  const enriched = enrichTask(task, { prd: MOCK_PRD });
  assert(enriched.feature_id, 'feature_id should be set');
  assert(enriched.feature_id.startsWith('feat-'));
});

test('adds owner_role', () => {
  const enriched = enrichTask(makeTask({ requiredRole: 'developer' }), { prd: MOCK_PRD });
  assertEqual(enriched.owner_role, 'backend_engineer');
});

test('adds owner_agent_id when team has matching role', () => {
  const task = makeTask({ requiredRole: 'developer' });
  const enriched = enrichTask(task, { prd: MOCK_PRD, team: MOCK_TEAM });
  assertEqual(enriched.owner_agent_id, 'agent_0042');
});

test('no owner_agent_id when team has unassigned role', () => {
  const task = makeTask({ requiredRole: 'qa' });
  const enriched = enrichTask(task, { prd: MOCK_PRD, team: MOCK_TEAM });
  assert(!enriched.owner_agent_id, 'unassigned role should not have agent_id');
});

test('no owner_agent_id when no team provided', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  assert(!enriched.owner_agent_id, 'no agent without team');
});

test('adds definition_of_done', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  assert(typeof enriched.definition_of_done === 'string' && enriched.definition_of_done.length > 0);
});

test('adds gates array', () => {
  const enriched = enrichTask(makeTask({ outputs: ['src/auth.ts'] }), { prd: MOCK_PRD });
  assert(Array.isArray(enriched.gates) && enriched.gates.length > 0);
});

test('adds input_artifacts array', () => {
  const task = makeTask({ inputs: ['src/models/user.ts'] });
  const enriched = enrichTask(task, { prd: MOCK_PRD });
  assert(Array.isArray(enriched.input_artifacts));
  assert(enriched.input_artifacts.includes('src/models/user.ts'));
});

test('adds output_artifacts array', () => {
  const task = makeTask({ outputs: ['src/api/auth.ts'] });
  const enriched = enrichTask(task, { prd: MOCK_PRD });
  assert(Array.isArray(enriched.output_artifacts));
  assert(enriched.output_artifacts.includes('src/api/auth.ts'));
});

test('preserves original task fields', () => {
  const task = makeTask({ id: 'task-xyz', name: 'Custom Task', dependsOn: ['task-000'] });
  const enriched = enrichTask(task, { prd: MOCK_PRD });
  assertEqual(enriched.id, 'task-xyz');
  assertEqual(enriched.name, 'Custom Task');
  assert(enriched.dependsOn.includes('task-000'));
});

test('does not mutate original task', () => {
  const task = makeTask();
  const original = JSON.stringify(task);
  enrichTask(task, { prd: MOCK_PRD });
  assertEqual(JSON.stringify(task), original, 'original task should not be mutated');
});

test('marks _enriched flag', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  assert(enriched._enriched === true);
});

test('works with no prd or team', () => {
  const enriched = enrichTask(makeTask());
  assert(enriched.owner_role);
  assert(enriched.gates);
});

// ── validateEnrichedTask ──────────────────────────────────────────────────────

console.log('\nvalidateEnrichedTask');

test('valid enriched task passes', () => {
  const enriched = enrichTask(makeTask({ outputs: ['src/auth.ts'] }), { prd: MOCK_PRD });
  const { valid, errors } = validateEnrichedTask(enriched);
  assert(valid, errors.join(', '));
});

test('null task fails', () => {
  const { valid } = validateEnrichedTask(null);
  assert(!valid);
});

test('missing feature_id fails', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  delete enriched.feature_id;
  const { valid, errors } = validateEnrichedTask(enriched);
  assert(!valid);
  assert(errors.some(e => e.includes('feature_id')));
});

test('missing DoD fails', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  delete enriched.definition_of_done;
  const { valid } = validateEnrichedTask(enriched);
  assert(!valid);
});

test('empty gates fails', () => {
  const enriched = enrichTask(makeTask(), { prd: MOCK_PRD });
  enriched.gates = [];
  const { valid } = validateEnrichedTask(enriched);
  assert(!valid);
});

// ── enrichPlan ────────────────────────────────────────────────────────────────

console.log('\nenrichPlan');

test('enriches all tasks in plan', () => {
  const plan = makePlan([
    makeTask({ id: 'task-001', name: 'auth login', requiredRole: 'developer' }),
    makeTask({ id: 'task-002', name: 'stripe payment', requiredRole: 'developer' }),
    makeTask({ id: 'task-003', name: 'admin dashboard', requiredRole: 'qa' }),
  ]);
  const enriched = enrichPlan(plan, { prd: MOCK_PRD, team: MOCK_TEAM });
  assertEqual(enriched.tasks.length, 3);
  assert(enriched.tasks.every(t => t._enriched));
});

test('enrichPlan preserves plan metadata', () => {
  const plan = makePlan([makeTask()]);
  const enriched = enrichPlan(plan, { prd: MOCK_PRD });
  assertEqual(enriched.featureSlug, 'test-feature');
  assertEqual(enriched.version, 1);
});

test('enrichPlan adds _enrichment summary', () => {
  const plan = makePlan([makeTask()]);
  const enriched = enrichPlan(plan, { prd: MOCK_PRD, projectId: 'proj-x' });
  assert(enriched._enrichment, 'missing _enrichment');
  assertEqual(enriched._enrichment.total_tasks, 1);
  assertEqual(enriched._enrichment.project_id, 'proj-x');
});

test('enrichPlan counts assigned vs unassigned', () => {
  const plan = makePlan([
    makeTask({ requiredRole: 'developer' }),  // has agent (backend_engineer)
    makeTask({ requiredRole: 'qa' }),          // no agent (unassigned)
  ]);
  const enriched = enrichPlan(plan, { prd: MOCK_PRD, team: MOCK_TEAM });
  assertEqual(enriched._enrichment.assigned_tasks, 1);
  assertEqual(enriched._enrichment.unassigned_tasks, 1);
});

test('enrichPlan tracks feature_coverage', () => {
  const plan = makePlan([
    makeTask({ name: 'auth login', description: 'user authentication login' }),
    makeTask({ name: 'auth register', description: 'user authentication register' }),
  ]);
  const enriched = enrichPlan(plan, { prd: MOCK_PRD });
  assert(enriched._enrichment.feature_coverage, 'missing feature_coverage');
  const total = Object.values(enriched._enrichment.feature_coverage).reduce((s, v) => s + v, 0);
  assertEqual(total, 2);
});

test('throws on plan without tasks array', () => {
  let threw = false;
  try { enrichPlan({}, { prd: MOCK_PRD }); } catch { threw = true; }
  assert(threw, 'should throw on invalid plan');
});

// ── savePlan / loadPlan ───────────────────────────────────────────────────────

console.log('\nsavePlan / loadPlan');

let tmpDir;

test('savePlan creates plan.enriched.json', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-enrich-'));
  const plan = enrichPlan(makePlan([makeTask()]), { prd: MOCK_PRD });
  savePlan(tmpDir, 'proj-save', plan);
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-save', 'plan.enriched.json')));
});

test('loadPlan returns saved plan', () => {
  const plan = enrichPlan(makePlan([makeTask()]), { prd: MOCK_PRD });
  savePlan(tmpDir, 'proj-load', plan);
  const loaded = loadPlan(tmpDir, 'proj-load');
  assert(loaded !== null);
  assert(loaded.tasks?.length === 1);
  assert(loaded._enrichment);
});

test('loadPlan returns null for missing project', () => {
  assert(loadPlan(tmpDir, 'nonexistent-xyz') === null);
});

test('enriched tasks survive round-trip', () => {
  const plan = enrichPlan(makePlan([makeTask({ outputs: ['src/auth.ts'] })]), { prd: MOCK_PRD, team: MOCK_TEAM });
  savePlan(tmpDir, 'proj-roundtrip', plan);
  const loaded = loadPlan(tmpDir, 'proj-roundtrip');
  const task = loaded.tasks[0];
  assert(task.feature_id, 'feature_id lost in round-trip');
  assert(task.definition_of_done, 'DoD lost in round-trip');
  assert(task.gates?.length > 0, 'gates lost in round-trip');
  const { valid, errors } = validateEnrichedTask(task);
  assert(valid, errors.join(', '));
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
