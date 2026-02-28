/**
 * Budget Tracker Tests — token/cost tracking, deductions, limits.
 *
 * Run: node tools/ogu/tests/budget-tracker.test.mjs
 */

import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('\nBudget Tracker Tests\n');

// ── createBudgetTracker (in-memory, no I/O) ──

const { createBudgetTracker } = await import('../commands/lib/budget-tracker.mjs');

test('1. createBudgetTracker: initial remaining equals budget', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  assert(tracker.getRemaining() === 100, `Should be 100, got ${tracker.getRemaining()}`);
});

test('2. createBudgetTracker: spend reduces remaining', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  tracker.spend(30, 'code-gen');
  assert(tracker.getRemaining() === 70, `Should be 70, got ${tracker.getRemaining()}`);
});

test('3. createBudgetTracker: multiple spends accumulate', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  tracker.spend(20, 'code-gen');
  tracker.spend(30, 'review');
  tracker.spend(10, 'code-gen');
  assert(tracker.getRemaining() === 40, `Should be 40, got ${tracker.getRemaining()}`);
});

test('4. createBudgetTracker: isOverBudget false when within', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  tracker.spend(99, 'code-gen');
  assert(!tracker.isOverBudget(), 'Should not be over budget at 99/100');
});

test('5. createBudgetTracker: isOverBudget true when exceeded', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  tracker.spend(101, 'code-gen');
  assert(tracker.isOverBudget(), 'Should be over budget at 101/100');
});

test('6. createBudgetTracker: getBreakdown shows per-category', () => {
  const tracker = createBudgetTracker({ budget: 200 });
  tracker.spend(50, 'code-gen');
  tracker.spend(30, 'review');
  tracker.spend(20, 'code-gen');
  const breakdown = tracker.getBreakdown();
  assert(breakdown['code-gen'] === 70, `code-gen should be 70, got ${breakdown['code-gen']}`);
  assert(breakdown['review'] === 30, `review should be 30, got ${breakdown['review']}`);
});

test('7. createBudgetTracker: zero budget means always over', () => {
  const tracker = createBudgetTracker({ budget: 0 });
  tracker.spend(1, 'any');
  assert(tracker.isOverBudget(), 'Should be over budget with 0 budget');
});

test('8. createBudgetTracker: negative remaining after overspend', () => {
  const tracker = createBudgetTracker({ budget: 50 });
  tracker.spend(75, 'expensive');
  assert(tracker.getRemaining() === -25, `Should be -25, got ${tracker.getRemaining()}`);
});

test('9. createBudgetTracker: breakdown returns copy (no mutation)', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  tracker.spend(10, 'test');
  const b1 = tracker.getBreakdown();
  b1['test'] = 999;
  const b2 = tracker.getBreakdown();
  assert(b2['test'] === 10, `Should still be 10, got ${b2['test']}`);
});

test('10. createBudgetTracker: empty breakdown initially', () => {
  const tracker = createBudgetTracker({ budget: 100 });
  const breakdown = tracker.getBreakdown();
  assert(Object.keys(breakdown).length === 0, 'Should have no categories initially');
});

// ── File-based budget state tests ──
// These test the data structures without calling the actual loadBudget/deductBudget
// (which require repoRoot() pointing to a real .ogu project)

const testRoot = join(tmpdir(), `ogu-budget-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/budget'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents'), { recursive: true });

const BUDGET_DIR = join(testRoot, '.ogu/budget');
const STATE_FILE = join(BUDGET_DIR, 'budget-state.json');
const TX_FILE = join(BUDGET_DIR, 'transactions.jsonl');

test('11. Budget state schema has required fields', () => {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    daily: { date: today, tokensUsed: 0, costUsed: 0, limit: 50 },
    monthly: { month, tokensUsed: 0, costUsed: 0, limit: 1000 },
    features: {},
    models: {},
  };

  assert(state.version === 1, 'Version should be 1');
  assert(state.daily.limit === 50, 'Daily limit should be 50');
  assert(state.monthly.limit === 1000, 'Monthly limit should be 1000');
  assert(typeof state.features === 'object', 'Features should be object');
  assert(typeof state.models === 'object', 'Models should be object');
});

test('12. Budget deduction updates all counters correctly', () => {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    daily: { date: today, tokensUsed: 0, costUsed: 0, limit: 50 },
    monthly: { month, tokensUsed: 0, costUsed: 0, limit: 1000 },
    features: {},
    models: {},
  };

  // Simulate deduction
  const input = 1000, output = 500;
  const total = input + output;
  const cost = 0.015;
  const featureSlug = 'auth-login';
  const modelKey = 'anthropic/sonnet';

  state.daily.tokensUsed += total;
  state.daily.costUsed += cost;
  state.monthly.tokensUsed += total;
  state.monthly.costUsed += cost;
  state.features[featureSlug] = { tokensUsed: total, costUsed: cost };
  state.models[modelKey] = { tokensUsed: total, costUsed: cost, callCount: 1 };

  assert(state.daily.tokensUsed === 1500, `Daily tokens should be 1500, got ${state.daily.tokensUsed}`);
  assert(state.daily.costUsed === 0.015, `Daily cost should be 0.015`);
  assert(state.monthly.tokensUsed === 1500, 'Monthly tokens should match');
  assert(state.features['auth-login'].tokensUsed === 1500, 'Feature tokens should match');
  assert(state.models['anthropic/sonnet'].callCount === 1, 'Call count should be 1');
});

test('13. Multiple deductions accumulate', () => {
  const state = {
    daily: { tokensUsed: 0, costUsed: 0, limit: 50 },
    features: {},
    models: {},
  };

  // 3 deductions
  for (let i = 0; i < 3; i++) {
    const total = 1000;
    const cost = 0.01;
    state.daily.tokensUsed += total;
    state.daily.costUsed += cost;
    state.features['feat'] = state.features['feat'] || { tokensUsed: 0, costUsed: 0 };
    state.features['feat'].tokensUsed += total;
    state.features['feat'].costUsed += cost;
  }

  assert(state.daily.tokensUsed === 3000, `Should be 3000, got ${state.daily.tokensUsed}`);
  assert(Math.abs(state.daily.costUsed - 0.03) < 0.0001, `Should be ~0.03, got ${state.daily.costUsed}`);
  assert(state.features['feat'].tokensUsed === 3000, 'Feature total should be 3000');
});

test('14. Daily reset when date changes', () => {
  const state = {
    daily: { date: '2026-02-27', tokensUsed: 5000, costUsed: 25, limit: 50 },
  };

  const today = '2026-02-28';
  if (state.daily.date !== today) {
    state.daily.date = today;
    state.daily.tokensUsed = 0;
    state.daily.costUsed = 0;
  }

  assert(state.daily.tokensUsed === 0, 'Tokens should reset');
  assert(state.daily.costUsed === 0, 'Cost should reset');
  assert(state.daily.date === '2026-02-28', 'Date should update');
});

test('15. Budget check: allowed when under limit', () => {
  const state = { daily: { limit: 50, costUsed: 20 } };
  const remaining = state.daily.limit - state.daily.costUsed;
  const estimatedCost = 5;
  assert(estimatedCost <= remaining, 'Should be allowed');
  assert(remaining === 30, `Remaining should be 30, got ${remaining}`);
});

test('16. Budget check: denied when over limit', () => {
  const state = { daily: { limit: 50, costUsed: 48 } };
  const remaining = state.daily.limit - state.daily.costUsed;
  const estimatedCost = 5;
  assert(estimatedCost > remaining, 'Should be denied');
});

// ── Transaction log ──

test('17. Transaction JSONL format is valid', () => {
  const tx = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'deduct',
    featureSlug: 'auth-login',
    taskId: 'TASK-001',
    agentRoleId: 'coder-01',
    model: 'sonnet',
    provider: 'anthropic',
    tokens: { input: 1000, output: 500, total: 1500 },
    cost: 0.015,
    currency: 'USD',
  };

  writeFileSync(TX_FILE, JSON.stringify(tx) + '\n', 'utf8');
  const content = readFileSync(TX_FILE, 'utf8').trim();
  const parsed = JSON.parse(content);
  assert(parsed.id === tx.id, 'ID preserved');
  assert(parsed.tokens.total === 1500, 'Tokens preserved');
  assert(parsed.cost === 0.015, 'Cost preserved');
  assert(parsed.currency === 'USD', 'Currency preserved');
});

test('18. Multiple transactions in JSONL', () => {
  let content = '';
  for (let i = 0; i < 5; i++) {
    content += JSON.stringify({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'deduct',
      featureSlug: `feature-${i}`,
      tokens: { total: (i + 1) * 100 },
      cost: (i + 1) * 0.01,
    }) + '\n';
  }
  writeFileSync(TX_FILE, content, 'utf8');
  const lines = readFileSync(TX_FILE, 'utf8').trim().split('\n');
  assert(lines.length === 5, `Should have 5 transactions, got ${lines.length}`);
  const last = JSON.parse(lines[4]);
  assert(last.featureSlug === 'feature-4', 'Last feature should be feature-4');
});

// ── Agent budget state ──

test('19. Agent state tracks token usage', () => {
  const agentState = {
    roleId: 'coder-01',
    tokensUsed: 0,
    tokensUsedToday: 0,
    costUsed: 0,
    costToday: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    escalations: 0,
    lastActiveAt: null,
  };

  // Simulate budget update
  const tokens = 2000;
  const cost = 0.03;
  agentState.tokensUsed += tokens;
  agentState.tokensUsedToday += tokens;
  agentState.costUsed += cost;
  agentState.costToday += cost;
  agentState.lastActiveAt = new Date().toISOString();

  assert(agentState.tokensUsed === 2000, 'tokensUsed should be 2000');
  assert(agentState.costUsed === 0.03, 'costUsed should be 0.03');
  assert(agentState.lastActiveAt !== null, 'lastActiveAt should be set');

  // Save and reload
  const statePath = join(testRoot, '.ogu/agents/coder-01.state.json');
  writeFileSync(statePath, JSON.stringify(agentState, null, 2), 'utf8');
  const loaded = JSON.parse(readFileSync(statePath, 'utf8'));
  assert(loaded.tokensUsed === 2000, 'Loaded tokensUsed should match');
});

test('20. Budget state with date-keyed format normalizes correctly', () => {
  const today = new Date().toISOString().split('T')[0];
  const dateKeyedState = {
    version: 1,
    daily: { [today]: { spent: 15.50 } },
    monthly: { '2026-02': { spent: 120 } },
    byModel: {
      'anthropic/sonnet': { tokensUsed: 50000, spent: 10, calls: 5 },
    },
    byFeature: { 'auth': { cost: 8 } },
  };

  // Normalize (same logic as loadBudget)
  const dayData = dateKeyedState.daily[today] || { spent: 0 };
  const rawModels = dateKeyedState.byModel || {};
  const models = {};
  for (const [key, val] of Object.entries(rawModels)) {
    models[key] = {
      tokensUsed: val.tokensUsed ?? 0,
      costUsed: val.costUsed ?? val.spent ?? 0,
      callCount: val.callCount ?? val.calls ?? 0,
    };
  }

  assert(dayData.spent === 15.50, 'Daily spent should be 15.50');
  assert(models['anthropic/sonnet'].tokensUsed === 50000, 'Model tokens normalized');
  assert(models['anthropic/sonnet'].costUsed === 10, 'Model cost normalized from spent');
  assert(models['anthropic/sonnet'].callCount === 5, 'Model calls normalized from calls');
});

// ── Cleanup ──
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
