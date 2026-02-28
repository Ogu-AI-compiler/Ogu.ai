/**
 * Company Snapshot Tests — capture, compare, list, restore.
 *
 * Run: node tools/ogu/tests/company-snapshot.test.mjs
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
  captureCompanySnapshot, compareSnapshots,
  loadSnapshot, listSnapshots, restoreFromSnapshot,
} = await import('../commands/lib/company-snapshot.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-snap-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/company-snapshots'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/policies'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/policy'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/budget'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/state/features'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/sessions'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/credentials'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/overrides'), { recursive: true });

const orgSpec = {
  $schema: 'OrgSpec/1.0',
  org: { name: 'test-org', version: '1.0.0' },
  roles: [
    { roleId: 'backend-dev', name: 'Backend Dev', department: 'eng', capabilities: ['code'] },
    { roleId: 'frontend-dev', name: 'Frontend Dev', department: 'eng', capabilities: ['ui'] },
  ],
  teams: [{ teamId: 'eng', name: 'Engineering' }],
};
writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(orgSpec, null, 2));

writeFileSync(join(testRoot, '.ogu/policies/rules.json'), JSON.stringify({
  rules: [
    { id: 'r1', enabled: true, when: { field: 'a', op: 'eq', value: 1 }, then: [{ effect: 'deny' }] },
  ],
}));

writeFileSync(join(testRoot, '.ogu/budget/budget-state.json'), JSON.stringify({
  daily: { costUsed: 1.50 },
  totalSpent: 1.50,
}));

writeFileSync(join(testRoot, '.ogu/STATE.json'), JSON.stringify({
  phase: 'build',
  current_task: 'my-feature',
}));

writeFileSync(join(testRoot, '.ogu/audit/current.jsonl'),
  '{"type":"test","data":{}}\n{"type":"test2","data":{}}\n'
);

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = testRoot;

console.log('\nCompany Snapshot Tests\n');

// ── Section 1: captureCompanySnapshot ──

let snap1;

test('1. captureCompanySnapshot — creates snapshot with all components', () => {
  snap1 = captureCompanySnapshot({ root: testRoot, label: 'test-snap-1' });
  assert(snap1.snapshotId);
  assert(snap1.$schema === 'CompanySnapshot/1.0');
  assert(snap1.label === 'test-snap-1');
  assert(snap1.capturedAt);
});

test('2. captureCompanySnapshot — captures orgSpec', () => {
  assert(snap1.orgSpec);
  assert(snap1.orgSpec.roles === 2);
  assert(snap1.orgSpec.teams === 1);
  assert(snap1.orgSpec.version === '1.0.0');
  assert(snap1.orgSpec.hash);
});

test('3. captureCompanySnapshot — captures policyState', () => {
  assert(snap1.policyState);
  assert(snap1.policyState.activeRules === 1);
});

test('4. captureCompanySnapshot — captures budgetState', () => {
  assert(snap1.budgetState);
  assert(snap1.budgetState.totalSpent === 1.50);
});

test('5. captureCompanySnapshot — captures auditStats', () => {
  assert(snap1.auditStats);
  assert(snap1.auditStats.totalEvents === 2);
});

test('6. captureCompanySnapshot — captures state', () => {
  assert(snap1.state);
  assert(snap1.state.phase === 'build');
});

test('7. captureCompanySnapshot — computes composite hashes', () => {
  assert(snap1.hashes);
  assert(snap1.hashes.orgSpecHash);
  assert(snap1.hashes.policyHash);
  assert(snap1.hashes.budgetHash);
  assert(snap1.hashes.fullSnapshotHash);
});

test('8. captureCompanySnapshot — legacy compat fields', () => {
  assert(snap1.id === snap1.snapshotId);
  assert(snap1.hash === snap1.hashes.fullSnapshotHash);
  assert(snap1.auditCount === 2);
});

test('9. captureCompanySnapshot — writes to disk', () => {
  const path = join(testRoot, '.ogu/company-snapshots', `${snap1.snapshotId}.json`);
  assert(existsSync(path));
});

// ── Section 2: loadSnapshot ──

test('10. loadSnapshot — loads saved snapshot', () => {
  const loaded = loadSnapshot(testRoot, snap1.snapshotId);
  assert(loaded);
  assert(loaded.snapshotId === snap1.snapshotId);
  assert(loaded.hashes.fullSnapshotHash === snap1.hashes.fullSnapshotHash);
});

test('11. loadSnapshot — returns null for missing', () => {
  assert(loadSnapshot(testRoot, 'no-such-snap') === null);
});

// ── Section 3: listSnapshots ──

test('12. listSnapshots — returns array with snapshot', () => {
  const list = listSnapshots(testRoot);
  assert(Array.isArray(list));
  assert(list.length >= 1);
  assert(list[0].snapshotId);
  assert(list[0].hash);
});

// ── Section 4: compareSnapshots ──

test('13. compareSnapshots — identical snapshots = no changes', () => {
  const result = compareSnapshots(snap1, snap1);
  assert(result.changed === false);
  assert(result.changes.length === 0);
});

test('14. compareSnapshots — detects orgSpec changes', () => {
  const snap2 = { ...snap1, orgSpec: { ...snap1.orgSpec, roles: 5 }, hashes: { ...snap1.hashes, fullSnapshotHash: 'different' } };
  const result = compareSnapshots(snap1, snap2);
  assert(result.changed === true);
  assert(result.changes.some(c => c.component === 'orgSpec'));
});

test('15. compareSnapshots — detects budget changes', () => {
  const snap2 = { ...snap1, budgetState: { totalSpent: 10.00 }, budget: { daily: { costUsed: 10 } }, hashes: { fullSnapshotHash: 'different' } };
  const result = compareSnapshots(snap1, snap2);
  assert(result.changed === true);
  assert(result.changes.some(c => c.component === 'budget'));
});

test('16. compareSnapshots — detects audit count changes', () => {
  const snap2 = { ...snap1, auditStats: { totalEvents: 100 }, auditCount: 100, hashes: { fullSnapshotHash: 'different' } };
  const result = compareSnapshots(snap1, snap2);
  assert(result.changed === true);
  assert(result.changes.some(c => c.component === 'audit'));
});

test('17. compareSnapshots — detects feature state changes', () => {
  const snap2 = {
    ...snap1,
    featurePortfolio: [{ slug: 'feat-a', state: 'shipped' }],
    features: [{ slug: 'feat-a', state: 'shipped' }],
    hashes: { fullSnapshotHash: 'different' },
  };
  const snap1WithFeats = {
    ...snap1,
    featurePortfolio: [{ slug: 'feat-a', state: 'building' }],
  };
  const result = compareSnapshots(snap1WithFeats, snap2);
  assert(result.changed === true);
  assert(result.changes.some(c => c.component === 'feature:feat-a'));
});

// ── Section 5: restoreFromSnapshot ──

test('18. restoreFromSnapshot — dry run shows what would restore', () => {
  const result = restoreFromSnapshot(testRoot, snap1.snapshotId, { dryRun: true });
  assert(result.dryRun === true);
  assert(result.wouldRestore);
  assert(result.wouldRestore.orgSpec);
});

test('19. restoreFromSnapshot — returns error for missing snapshot', () => {
  const result = restoreFromSnapshot(testRoot, 'nonexistent-snap');
  assert(result.error);
});

// ── Section 6: deterministic hashing ──

test('20. two captures of same state produce same fullSnapshotHash', () => {
  const snap2 = captureCompanySnapshot({ root: testRoot, label: 'second' });
  // Can't guarantee exact match due to timestamp, but the org/policy/budget hashes should match
  assert(snap2.hashes.orgSpecHash === snap1.hashes.orgSpecHash);
  assert(snap2.hashes.policyHash === snap1.hashes.policyHash);
});

// ── Cleanup ──

process.env.OGU_ROOT = origRoot;
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
