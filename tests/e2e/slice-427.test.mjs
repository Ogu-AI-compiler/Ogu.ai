/**
 * slice-427.test.mjs — Architect: PRD → Task Graph
 * Tests: generateTaskGraph, detectFeatureSignals, selectTaskTemplates,
 *        assignOwnerRole, validateTaskGraph
 */

import {
  generateTaskGraph,
  detectFeatureSignals,
  selectTaskTemplates,
  assignOwnerRole,
  validateTaskGraph,
  buildTaskDependencies,
} from '../../tools/ogu/commands/lib/architect.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── detectFeatureSignals ──────────────────────────────────────────────────────

console.log('\ndetectFeatureSignals');

const authFeature = {
  id: 'feat-auth', title: 'User Authentication',
  flows: ['login flow', 'signup flow'],
  acceptance_criteria: ['User can login with email and password'],
  entities: ['User', 'Session'],
};

test('detects auth signal from title', () => {
  const signals = detectFeatureSignals(authFeature);
  assert(signals.has('auth'), 'should detect auth signal');
});

test('detects entities signal from entities array', () => {
  const signals = detectFeatureSignals(authFeature);
  assert(signals.has('entities'), 'should detect entities signal');
});

test('detects database signal from criteria text', () => {
  const feat = { id: 'f', title: 'User data', acceptance_criteria: ['store user in database'], entities: [] };
  const signals = detectFeatureSignals(feat);
  assert(signals.has('database'), 'should detect database signal');
});

test('detects ui signal from flows', () => {
  const feat = { id: 'f', title: 'Dashboard', flows: ['user sees page with form button'], entities: [] };
  const signals = detectFeatureSignals(feat);
  assert(signals.has('ui'), 'should detect ui signal');
});

test('detects payment signal', () => {
  const feat = { id: 'f', title: 'Checkout', flows: ['payment flow with stripe'], entities: [] };
  const signals = detectFeatureSignals(feat);
  assert(signals.has('payment'), 'should detect payment signal');
});

test('returns Set type', () => {
  const signals = detectFeatureSignals(authFeature);
  assert(signals instanceof Set, 'should return a Set');
});

test('handles feature with no text gracefully', () => {
  const signals = detectFeatureSignals({ id: 'f', title: '' });
  assert(signals instanceof Set);
});

// ── selectTaskTemplates ───────────────────────────────────────────────────────

console.log('\nselectTaskTemplates');

test('includes api-endpoint always', () => {
  const templates = selectTaskTemplates({ id: 'f', title: 'Simple', flows: [], entities: [] }, new Set());
  assert(templates.includes('api-endpoint'), 'api-endpoint should always be included');
});

test('includes integration-test always', () => {
  const templates = selectTaskTemplates({ id: 'f', title: 'Simple', flows: [], entities: [] }, new Set());
  assert(templates.includes('integration-test'), 'integration-test should always be included');
});

test('includes db-schema when entities present', () => {
  const templates = selectTaskTemplates(authFeature, new Set());
  assert(templates.includes('db-schema'), 'db-schema should be included when entities present');
});

test('includes auth-middleware for auth features', () => {
  const templates = selectTaskTemplates(authFeature, new Set());
  assert(templates.includes('auth-middleware'), 'auth-middleware included for auth features');
});

test('includes security-review for payment features', () => {
  const feat = { id: 'f', title: 'Payment', flows: ['payment with stripe'], entities: [] };
  const templates = selectTaskTemplates(feat, new Set());
  assert(templates.includes('security-review'), 'security-review included for payment');
});

test('includes e2e-test when flows present', () => {
  const templates = selectTaskTemplates(authFeature, new Set());
  assert(templates.includes('e2e-test'), 'e2e-test included when flows present');
});

test('includes ui-component when ui signal and frontend_engineer available', () => {
  const feat = { id: 'f', title: 'Login page with form', flows: [], entities: [] };
  const templates = selectTaskTemplates(feat, new Set(['frontend_engineer']));
  assert(templates.includes('ui-component'), 'ui-component included when frontend_engineer available');
});

test('excludes ui-component when no frontend_engineer and availableRoles specified', () => {
  const feat = { id: 'f', title: 'Login page with form', flows: [], entities: [] };
  const templates = selectTaskTemplates(feat, new Set(['backend_engineer', 'qa']));
  // ui-component should NOT be included since frontend_engineer not in set
  assert(!templates.includes('ui-component'), 'ui-component excluded without frontend_engineer');
});

// ── assignOwnerRole ───────────────────────────────────────────────────────────

console.log('\nassignOwnerRole');

test('db-schema → backend_engineer', () => {
  assertEqual(assignOwnerRole('db-schema'), 'backend_engineer');
});
test('api-endpoint → backend_engineer', () => {
  assertEqual(assignOwnerRole('api-endpoint'), 'backend_engineer');
});
test('ui-component → frontend_engineer', () => {
  assertEqual(assignOwnerRole('ui-component'), 'frontend_engineer');
});
test('integration-test → qa', () => {
  assertEqual(assignOwnerRole('integration-test'), 'qa');
});
test('security-review → security', () => {
  assertEqual(assignOwnerRole('security-review'), 'security');
});
test('unknown template → backend_engineer (fallback)', () => {
  assertEqual(assignOwnerRole('unknown-type'), 'backend_engineer');
});

// ── generateTaskGraph ─────────────────────────────────────────────────────────

console.log('\ngenerateTaskGraph');

const simplePRD = {
  meta: { version: '1.0', created_at: new Date().toISOString() },
  product: { name: 'Test App', one_liner: 'A test app', target_users: ['devs'], primary_value: 'testing' },
  features: [
    {
      id: 'feat-auth',
      title: 'User Authentication',
      priority: 'must',
      flows: ['login flow', 'signup flow'],
      acceptance_criteria: ['User can login'],
      entities: ['User', 'Session'],
      dependencies: [],
    },
  ],
  non_functional: { performance: '', security: '', reliability: '', observability: '' },
  out_of_scope: [],
  success_metrics: [],
};

let graph;

test('returns non-empty array', () => {
  graph = generateTaskGraph(simplePRD, null, 'test-proj');
  assert(Array.isArray(graph), 'should return array');
  assert(graph.length > 0, 'should return non-empty graph');
});

test('includes setup-infrastructure task', () => {
  const setupTask = graph.find(t => t.id.includes('setup-infrastructure') || t.title.includes('infrastructure'));
  assert(setupTask !== undefined, 'should have setup-infrastructure task');
});

test('all tasks have required fields', () => {
  for (const task of graph) {
    assert(task.id, `task missing id: ${JSON.stringify(task)}`);
    assert(task.title, `task "${task.id}" missing title`);
    assert(task.owner_role, `task "${task.id}" missing owner_role`);
    assert(task.definition_of_done, `task "${task.id}" missing definition_of_done`);
    assert(Array.isArray(task.gates) && task.gates.length > 0, `task "${task.id}" missing gates`);
    assert(Array.isArray(task.input_artifacts), `task "${task.id}" missing input_artifacts`);
    assert(Array.isArray(task.output_artifacts), `task "${task.id}" missing output_artifacts`);
    assert(typeof task.time_budget_minutes === 'number' && task.time_budget_minutes > 0, `task "${task.id}" bad time_budget_minutes`);
    assert(Array.isArray(task.dependsOn), `task "${task.id}" missing dependsOn`);
  }
});

test('generates tasks for auth feature', () => {
  const authTasks = graph.filter(t => t.feature_id === 'feat-auth');
  assert(authTasks.length >= 2, `expected >=2 auth tasks, got ${authTasks.length}`);
});

test('auth-middleware task generated exactly once', () => {
  const authMiddlewares = graph.filter(t => t.id.includes('auth-middleware'));
  assert(authMiddlewares.length === 1, `expected 1 auth-middleware, got ${authMiddlewares.length}`);
});

test('non-setup tasks depend on setup task', () => {
  const setupTask = graph.find(t => t.id.includes('setup-infrastructure'));
  assert(setupTask, 'setup task must exist');
  const nonSetup = graph.filter(t => t.id !== setupTask.id);
  for (const task of nonSetup) {
    assert(
      task.dependsOn.includes(setupTask.id),
      `task "${task.id}" should depend on setup task`
    );
  }
});

test('test-layer tasks depend on api-layer tasks in same feature', () => {
  const apiTask = graph.find(t => t.layer === 'api' && t.feature_id === 'feat-auth');
  const testTask = graph.find(t => t.layer === 'test' && t.feature_id === 'feat-auth');
  if (apiTask && testTask) {
    assert(
      testTask.dependsOn.includes(apiTask.id),
      `test task "${testTask.id}" should depend on api task "${apiTask.id}"`
    );
  }
});

test('returns empty array for null prd', () => {
  const result = generateTaskGraph(null, null, 'p');
  assert(Array.isArray(result) && result.length === 0);
});

test('returns empty array for prd with no features', () => {
  const result = generateTaskGraph({ features: [] }, null, 'p');
  assert(Array.isArray(result) && result.length === 0);
});

// Multi-feature PRD
const multiPRD = {
  meta: { version: '1.0', created_at: new Date().toISOString() },
  product: { name: 'Multi', one_liner: '', target_users: [], primary_value: '' },
  features: [
    { id: 'feat-auth', title: 'Auth', priority: 'must', flows: ['login'], acceptance_criteria: ['can login'], entities: ['User'], dependencies: [] },
    { id: 'feat-dashboard', title: 'Dashboard', priority: 'must', flows: ['view dashboard'], acceptance_criteria: ['sees dashboard'], entities: [], dependencies: ['feat-auth'] },
  ],
  non_functional: { performance: '', security: '', reliability: '', observability: '' },
  out_of_scope: [],
  success_metrics: [],
};

test('multi-feature: dashboard tasks depend on auth infra tasks', () => {
  const multiGraph = generateTaskGraph(multiPRD, null, 'multi-proj');
  const authInfraTasks = multiGraph.filter(t => t.feature_id === 'feat-auth' && (t.layer === 'data' || t.layer === 'api'));
  const dashFirstTasks = multiGraph.filter(t => t.feature_id === 'feat-dashboard' && t.layer !== 'test').slice(0, 2);

  if (authInfraTasks.length > 0 && dashFirstTasks.length > 0) {
    for (const dt of dashFirstTasks) {
      const hasAuthDep = authInfraTasks.some(at => dt.dependsOn.includes(at.id));
      assert(hasAuthDep, `dashboard task "${dt.id}" should depend on auth infra`);
    }
  }
});

test('all task ids are unique', () => {
  const ids = graph.map(t => t.id);
  const unique = new Set(ids);
  assertEqual(ids.length, unique.size, 'all task ids should be unique');
});

// ── validateTaskGraph ─────────────────────────────────────────────────────────

console.log('\nvalidateTaskGraph');

test('valid graph returns valid=true', () => {
  const result = validateTaskGraph(graph);
  if (!result.valid) {
    console.error('  validation errors:', result.errors);
  }
  assert(result.valid === true, `graph should be valid, errors: ${result.errors?.join(', ')}`);
});

test('empty array returns valid=false', () => {
  const result = validateTaskGraph([]);
  assert(result.valid === false);
  assert(result.errors.length > 0);
});

test('null returns valid=false', () => {
  const result = validateTaskGraph(null);
  assert(result.valid === false);
});

test('task missing required field returns error', () => {
  const badTask = { id: 'x', title: '', owner_role: 'qa', definition_of_done: 'ok', gates: ['tests-pass'], input_artifacts: [], output_artifacts: [], time_budget_minutes: 10, dependsOn: [] };
  const result = validateTaskGraph([badTask]);
  assert(!result.valid, 'should be invalid (missing title)');
  assert(result.errors.some(e => e.includes('title')), 'error should mention title');
});

test('duplicate task ids returns error', () => {
  const t = { ...graph[0] };
  const result = validateTaskGraph([t, { ...t }]);
  assert(!result.valid, 'should catch duplicate ids');
  assert(result.errors.some(e => e.includes('duplicate')));
});

test('unknown dependsOn returns error', () => {
  const badTask = { ...graph[0], id: 'unique-x', task_id: 'unique-x', dependsOn: ['nonexistent-dep'] };
  const result = validateTaskGraph([badTask]);
  assert(!result.valid);
  assert(result.errors.some(e => e.includes('nonexistent-dep')));
});

// ── buildTaskDependencies ─────────────────────────────────────────────────────

console.log('\nbuildTaskDependencies');

test('returns flat array of tasks', () => {
  const featMap = new Map([['feat-auth', graph.filter(t => t.feature_id === 'feat-auth')]]);
  const result = buildTaskDependencies(featMap, simplePRD);
  assert(Array.isArray(result), 'should return array');
});

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
