/**
 * Slice 432 — Feature Split Threshold
 * Tests splitFeatureTemplates and generateTaskGraph split behavior.
 */
import { strict as assert } from 'node:assert';
import {
  SPLIT_THRESHOLD,
  splitFeatureTemplates,
  selectTaskTemplates,
  generateTaskGraph,
  detectFeatureSignals,
  validateTaskGraph,
} from '../../tools/ogu/commands/lib/architect.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 432: Feature Split Threshold ===\n');

// ── SPLIT_THRESHOLD ──────────────────────────────────────────────────────────

test('SPLIT_THRESHOLD is 6', () => {
  assert.equal(SPLIT_THRESHOLD, 6);
});

// ── splitFeatureTemplates ────────────────────────────────────────────────────

test('splitFeatureTemplates: returns two sub-features with correct IDs', () => {
  const feature = { id: 'user-mgmt', title: 'User Management' };
  const templates = [
    'db-schema', 'auth-middleware', 'api-endpoint',
    'security-review', 'ui-component', 'integration-test', 'e2e-test',
    'db-schema', 'api-endpoint',
  ];
  const subs = splitFeatureTemplates(feature, templates);
  assert.equal(subs.length, 2);
  assert.equal(subs[0].id, 'user-mgmt-core');
  assert.equal(subs[1].id, 'user-mgmt-ui');
  assert.ok(subs[0].title.includes('Core'));
  assert.ok(subs[1].title.includes('UI'));
});

test('splitFeatureTemplates: core gets data+api layers', () => {
  const feature = { id: 'f1', title: 'F1' };
  const templates = [
    'db-schema', 'api-endpoint', 'auth-middleware',
    'ui-component', 'integration-test', 'e2e-test', 'security-review',
    'db-schema', 'api-endpoint',
  ];
  const [core, ui] = splitFeatureTemplates(feature, templates);
  // core: db-schema, api-endpoint, auth-middleware, db-schema, api-endpoint
  assert.ok(core._templates.includes('db-schema'));
  assert.ok(core._templates.includes('api-endpoint'));
  assert.ok(core._templates.includes('auth-middleware'));
  // ui: ui-component, integration-test, e2e-test, security-review
  assert.ok(ui._templates.includes('ui-component'));
  assert.ok(ui._templates.includes('integration-test'));
  assert.ok(ui._templates.includes('security-review'));
});

test('splitFeatureTemplates: ui sub depends on core sub', () => {
  const feature = { id: 'pay', title: 'Payment' };
  const [core, ui] = splitFeatureTemplates(feature, [
    'db-schema', 'api-endpoint', 'ui-component', 'integration-test',
    'e2e-test', 'security-review', 'auth-middleware', 'db-schema', 'api-endpoint',
  ]);
  assert.equal(ui._dependsOnSubFeature, 'pay-core');
  assert.equal(core._dependsOnSubFeature, undefined);
});

test('splitFeatureTemplates: preserves parent feature data', () => {
  const feature = { id: 'x', title: 'X', entities: ['User'], flows: ['login'] };
  const [core, ui] = splitFeatureTemplates(feature, ['db-schema', 'api-endpoint', 'ui-component']);
  assert.deepEqual(core.entities, ['User']);
  assert.deepEqual(ui.flows, ['login']);
  assert.equal(core._parentFeatureId, 'x');
  assert.equal(ui._parentFeatureId, 'x');
});

// ── generateTaskGraph: features ≤8 NOT split ─────────────────────────────────

test('generateTaskGraph: small feature NOT split', () => {
  const prd = {
    features: [{
      id: 'small',
      title: 'Small Feature',
      description: 'A small thing with api endpoints',
      acceptance_criteria: ['works'],
    }],
  };
  const tasks = generateTaskGraph(prd, null, 'proj');
  // All tasks should have feature_id 'small' (not 'small-core' or 'small-ui')
  const featureIds = new Set(tasks.map(t => t.feature_id).filter(Boolean));
  assert.ok(!featureIds.has('small-core'));
  assert.ok(!featureIds.has('small-ui'));
});

// ── generateTaskGraph: features >8 ARE split ─────────────────────────────────

test('generateTaskGraph: large feature IS split', () => {
  // Create a feature that triggers many signals
  const prd = {
    features: [{
      id: 'mega',
      title: 'Mega Feature',
      description: 'Build database tables with api endpoints, ui pages, auth login, payment checkout, search filter',
      entities: ['User', 'Payment', 'Order'],
      acceptance_criteria: ['auth works', 'payment processes'],
      flows: ['login flow', 'checkout flow', 'search flow'],
    }],
  };
  const templates = selectTaskTemplates(prd.features[0]);
  // Verify this feature generates >8 templates
  assert.ok(templates.length > SPLIT_THRESHOLD, `Expected >${SPLIT_THRESHOLD} templates, got ${templates.length}: ${templates.join(', ')}`);

  const tasks = generateTaskGraph(prd, null, 'proj');
  const featureIds = new Set(tasks.map(t => t.feature_id).filter(Boolean));
  assert.ok(featureIds.has('mega-core'), 'Expected mega-core sub-feature');
  assert.ok(featureIds.has('mega-ui'), 'Expected mega-ui sub-feature');
});

test('generateTaskGraph: split features have cross-dependencies', () => {
  const prd = {
    features: [{
      id: 'big',
      title: 'Big Feature',
      description: 'database table api endpoint ui page auth login payment stripe search filter',
      entities: ['A', 'B'],
      acceptance_criteria: ['works'],
      flows: ['flow1', 'flow2'],
    }],
  };
  const tasks = generateTaskGraph(prd, null, 'proj');
  const coreTasks = tasks.filter(t => t.feature_id === 'big-core');
  const uiTasks = tasks.filter(t => t.feature_id === 'big-ui');

  // UI tasks should depend on at least one core API task
  const coreApiIds = coreTasks.filter(t => t.layer === 'api').map(t => t.id);
  assert.ok(coreApiIds.length > 0, 'Core should have API tasks');

  const uiDepsOnCore = uiTasks.some(t =>
    t.dependsOn.some(d => coreApiIds.includes(d))
  );
  assert.ok(uiDepsOnCore, 'UI tasks should depend on core API tasks');
});

// ── Auth middleware deduplication still works ──────────────────────────────────

test('auth-middleware deduplication works across split features', () => {
  const prd = {
    features: [
      {
        id: 'f1',
        title: 'Feature 1',
        description: 'auth login database table api endpoint ui page payment checkout search filter',
        entities: ['X'],
        flows: ['flow1'],
        acceptance_criteria: ['ok'],
      },
      {
        id: 'f2',
        title: 'Feature 2',
        description: 'auth login database table api endpoint ui page payment checkout search filter',
        entities: ['Y'],
        flows: ['flow2'],
        acceptance_criteria: ['ok'],
      },
    ],
  };
  const tasks = generateTaskGraph(prd, null, 'proj');
  const authTasks = tasks.filter(t => t.id.includes('auth-middleware'));
  assert.equal(authTasks.length, 1, `Expected 1 auth-middleware task, got ${authTasks.length}`);
});

// ── validateTaskGraph still valid after split ─────────────────────────────────

test('validateTaskGraph passes on split graph', () => {
  const prd = {
    features: [{
      id: 'v',
      title: 'Valid',
      description: 'database table api endpoint ui page auth login payment stripe search filter',
      entities: ['E'],
      flows: ['f1'],
      acceptance_criteria: ['ok'],
    }],
  };
  const tasks = generateTaskGraph(prd, null, 'proj');
  const result = validateTaskGraph(tasks);
  assert.ok(result.valid, `Validation errors: ${result.errors.join('; ')}`);
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
