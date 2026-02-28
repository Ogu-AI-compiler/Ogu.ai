/**
 * Execution Graph Hash Tests — compute, verify, diff, legacy.
 *
 * Run: node tools/ogu/tests/execution-graph-hash.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const {
  computeGraphHash, verifyGraphHash, loadGraphHash,
  diffGraphHashes, hashDAG, hashExecution, compareExecutionHashes,
} = await import('../commands/lib/execution-graph-hash.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-graph-hash-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/state/graph-hashes'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/snapshots/test-feat'), { recursive: true });
mkdirSync(join(testRoot, 'docs/vault/04_Features/test-feat'), { recursive: true });

writeFileSync(join(testRoot, '.ogu/audit/current.jsonl'), '');

const plan = {
  tasks: [
    { id: 'task-1', name: 'Build auth', dependencies: [] },
    { id: 'task-2', name: 'Build UI', dependencies: ['task-1'] },
  ],
};
writeFileSync(join(testRoot, 'docs/vault/04_Features/test-feat/Plan.json'), JSON.stringify(plan));

const orgSpec = {
  org: { name: 'test-org', version: '1.0.0' },
  roles: [{ roleId: 'dev', capabilities: ['code'] }],
};
writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(orgSpec));

// Write a task snapshot
writeFileSync(join(testRoot, '.ogu/snapshots/test-feat/task-1.json'), JSON.stringify({
  taskId: 'task-1',
  hash: 'snap-hash-1',
  model: 'sonnet',
  provider: 'anthropic',
  capability: 'code_generation',
}));

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = testRoot;

console.log('\nExecution Graph Hash Tests\n');

// ── Section 1: computeGraphHash ──

let graphResult;

test('1. computeGraphHash — computes hash for feature', () => {
  graphResult = computeGraphHash(testRoot, 'test-feat');
  assert(graphResult);
  assert(graphResult.$schema === 'ExecutionGraphHash/1.0');
  assert(graphResult.featureSlug === 'test-feat');
  assert(graphResult.graphHash);
  assert(typeof graphResult.graphHash === 'string');
  assert(graphResult.graphHash.length === 64);
});

test('2. computeGraphHash — has all 7 component fields', () => {
  const c = graphResult.components;
  assert(c.planHash !== undefined);
  assert(c.policyVersionAtExecution !== undefined);
  assert(c.policyASTHash !== undefined);
  assert(c.orgSpecVersion !== undefined);
  assert(c.orgSpecHash !== undefined);
  assert(c.modelDecisionSetHash !== undefined);
  assert(c.taskSnapshotChainHash !== undefined);
});

test('3. computeGraphHash — planHash is not no-plan (plan exists)', () => {
  assert(graphResult.components.planHash !== 'no-plan');
});

test('4. computeGraphHash — orgSpecVersion matches', () => {
  assert(graphResult.components.orgSpecVersion === '1.0.0');
});

test('5. computeGraphHash — taskSnapshotHashes includes task-1', () => {
  assert(graphResult.components.taskSnapshotHashes['task-1'] === 'snap-hash-1');
});

test('6. computeGraphHash — extracts model routing decisions from snapshots', () => {
  const decisions = graphResult.components.modelRoutingDecisions;
  assert(Array.isArray(decisions));
  assert(decisions.length >= 1);
  assert(decisions[0].model === 'sonnet');
});

test('7. computeGraphHash — writes to disk', () => {
  assert(existsSync(join(testRoot, '.ogu/state/graph-hashes/test-feat.json')));
});

test('8. computeGraphHash — deterministic (same input = same hash)', () => {
  const result2 = computeGraphHash(testRoot, 'test-feat');
  assert(result2.graphHash === graphResult.graphHash);
});

// ── Section 2: loadGraphHash ──

test('9. loadGraphHash — loads saved result', () => {
  const loaded = loadGraphHash(testRoot, 'test-feat');
  assert(loaded);
  assert(loaded.graphHash === graphResult.graphHash);
});

test('10. loadGraphHash — null for missing feature', () => {
  assert(loadGraphHash(testRoot, 'nonexistent') === null);
});

// ── Section 3: verifyGraphHash ──

test('11. verifyGraphHash — match when hash is correct', () => {
  const result = verifyGraphHash(testRoot, 'test-feat', graphResult.graphHash);
  assert(result.match === true);
  assert(result.currentHash === graphResult.graphHash);
});

test('12. verifyGraphHash — no match when hash is wrong', () => {
  const result = verifyGraphHash(testRoot, 'test-feat', 'wrong-hash');
  assert(result.match === false);
  assert(result.expectedHash === 'wrong-hash');
});

// ── Section 4: diffGraphHashes ──

test('13. diffGraphHashes — identical hashes = no changes', () => {
  const diff = diffGraphHashes(graphResult, graphResult);
  assert(diff.match === true);
  assert(diff.changeCount === 0);
});

test('14. diffGraphHashes — detects plan change', () => {
  const modified = JSON.parse(JSON.stringify(graphResult));
  modified.graphHash = 'different';
  modified.components.planHash = 'changed-plan-hash';
  const diff = diffGraphHashes(graphResult, modified);
  assert(diff.match === false);
  assert(diff.changes.some(c => c.component === 'plan'));
});

test('15. diffGraphHashes — detects orgSpec change', () => {
  const modified = JSON.parse(JSON.stringify(graphResult));
  modified.graphHash = 'different';
  modified.components.orgSpecHash = 'changed';
  modified.components.orgSpecVersion = '2.0.0';
  const diff = diffGraphHashes(graphResult, modified);
  assert(diff.changes.some(c => c.component === 'orgSpec'));
});

test('16. diffGraphHashes — detects task snapshot changes', () => {
  const modified = JSON.parse(JSON.stringify(graphResult));
  modified.graphHash = 'different';
  modified.components.taskSnapshotChainHash = 'changed';
  modified.components.taskSnapshotHashes = { 'task-1': 'new-hash' };
  const diff = diffGraphHashes(graphResult, modified);
  assert(diff.changes.some(c => c.component === 'taskSnapshots'));
  const taskChange = diff.changes.find(c => c.component === 'taskSnapshots');
  assert(taskChange.taskChanges.length >= 1);
});

test('17. diffGraphHashes — error when missing inputs', () => {
  const result = diffGraphHashes(null, graphResult);
  assert(result.error);
});

// ── Section 5: Legacy — hashDAG ──

test('18. hashDAG — produces consistent hash', () => {
  const dag = { tasks: [{ id: 'a', deps: ['b'] }, { id: 'b', deps: [] }] };
  const h1 = hashDAG(dag);
  const h2 = hashDAG(dag);
  assert(h1 === h2);
  assert(typeof h1 === 'string');
  assert(h1.length === 64);
});

test('19. hashDAG — sorts tasks by id (order-independent)', () => {
  const dag1 = { tasks: [{ id: 'a', deps: [] }, { id: 'b', deps: [] }] };
  const dag2 = { tasks: [{ id: 'b', deps: [] }, { id: 'a', deps: [] }] };
  assert(hashDAG(dag1) === hashDAG(dag2));
});

test('20. hashDAG — different deps = different hash', () => {
  const dag1 = { tasks: [{ id: 'a', deps: [] }] };
  const dag2 = { tasks: [{ id: 'a', deps: ['b'] }] };
  assert(hashDAG(dag1) !== hashDAG(dag2));
});

// ── Section 6: Legacy — hashExecution + compare ──

test('21. hashExecution — produces hash from dag+inputs+outputs', () => {
  const h = hashExecution({ dagHash: 'abc', inputs: { a: 1 }, outputs: { b: 2 } });
  assert(typeof h === 'string');
  assert(h.length === 64);
});

test('22. hashExecution — deterministic', () => {
  const h1 = hashExecution({ dagHash: 'x', inputs: {}, outputs: {} });
  const h2 = hashExecution({ dagHash: 'x', inputs: {}, outputs: {} });
  assert(h1 === h2);
});

test('23. compareExecutionHashes — match true for same', () => {
  const result = compareExecutionHashes('abc', 'abc');
  assert(result.match === true);
});

test('24. compareExecutionHashes — match false for different', () => {
  const result = compareExecutionHashes('abc', 'def');
  assert(result.match === false);
});

// ── Section 7: Edge cases ──

test('25. computeGraphHash — no-plan when Plan.json missing', () => {
  mkdirSync(join(testRoot, '.ogu/state/graph-hashes'), { recursive: true });
  const result = computeGraphHash(testRoot, 'no-plan-feat');
  assert(result.components.planHash === 'no-plan');
});

test('26. computeGraphHash — empty snapshots = empty chain', () => {
  const result = computeGraphHash(testRoot, 'no-plan-feat');
  assert(Object.keys(result.components.taskSnapshotHashes).length === 0);
});

// ── Cleanup ──

process.env.OGU_ROOT = origRoot;
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
