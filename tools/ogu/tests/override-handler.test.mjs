import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `override-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu'), { recursive: true });
  // Write OrgSpec with roles that have override capability
  writeFileSync(join(TMP, '.ogu/OrgSpec.json'), JSON.stringify({
    roles: [
      { roleId: 'cto', enabled: true, capabilities: ['override', 'governance'] },
      { roleId: 'tech-lead', enabled: true, capabilities: ['override'] },
      { roleId: 'architect', enabled: true, capabilities: ['design', 'review'] },
      { roleId: 'backend-dev', enabled: true, capabilities: ['code_generation'] },
      { roleId: 'disabled-lead', enabled: false, capabilities: ['override'] },
    ],
  }), 'utf8');
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

// OGU_ROOT must be set for repoRoot()
const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = TMP;

const {
  createOverride, revokeOverride, listOverrides, checkOverride,
} = await import('../commands/lib/override-handler.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    teardown();
  }
}

console.log('\n  override-handler.mjs\n');

// ── createOverride ──

test('createOverride succeeds for authorized role (legacy)', () => {
  const result = createOverride({
    target: 'gate:3',
    reason: 'hotfix deployment',
    authority: 'cto',
    featureSlug: 'auth',
    root: TMP,
  });
  assert.ok(result.id);
  assert.equal(result.target, 'gate:3');
  assert.equal(result.authority.role, 'cto');
  assert.equal(result.status, 'active');
  assert.ok(result.createdAt);
  assert.ok(result.expiresAt);
});

test('createOverride writes to disk', () => {
  const result = createOverride({
    target: 'gate:5',
    reason: 'testing',
    authority: 'tech-lead',
    featureSlug: 'payments',
    root: TMP,
  });
  const filePath = join(TMP, '.ogu/overrides', `${result.id}.json`);
  assert.ok(existsSync(filePath));
  const saved = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.equal(saved.target, 'gate:5');
});

test('createOverride rejects unauthorized role', () => {
  assert.throws(
    () => createOverride({
      target: 'gate:1',
      reason: 'need access',
      authority: 'backend-dev',
      root: TMP,
    }),
    /not authorized/
  );
});

test('createOverride rejects without reason', () => {
  assert.throws(
    () => createOverride({
      target: 'gate:1',
      authority: 'cto',
      root: TMP,
    }),
    /requires a reason/
  );
});

test('createOverride with typed override: validation_skip', () => {
  const result = createOverride({
    target: 'validation:eslint',
    reason: 'CI timeout issue',
    authority: 'tech-lead',
    type: 'validation_skip',
    root: TMP,
  });
  assert.equal(result.type, 'validation_skip');
  assert.equal(result.impact.determinismBroken, false);
  assert.equal(result.auditLevel, 'warning');
});

test('createOverride with typed override: gate_skip requires ADR', () => {
  assert.throws(
    () => createOverride({
      target: 'gate:7',
      reason: 'emergency',
      authority: 'cto',
      type: 'gate_skip',
      root: TMP,
    }),
    /requires ADR reference/
  );
});

test('createOverride with gate_skip + ADR succeeds', () => {
  const result = createOverride({
    target: 'gate:7',
    reason: 'emergency skip',
    authority: 'cto',
    type: 'gate_skip',
    adrReference: 'ADR-042',
    gate: 'gate:7',
    root: TMP,
  });
  assert.equal(result.type, 'gate_skip');
  assert.equal(result.authority.adrReference, 'ADR-042');
  assert.equal(result.auditLevel, 'critical');
  assert.ok(result.impact.determinismBroken);
  assert.deepEqual(result.impact.gatesSkipped, ['gate:7']);
});

test('createOverride with governance_bypass requires cto', () => {
  assert.throws(
    () => createOverride({
      target: 'governance:deploy',
      reason: 'bypass',
      authority: 'tech-lead',
      type: 'governance_bypass',
      adrReference: 'ADR-1',
      root: TMP,
    }),
    /not authorized/
  );
});

test('createOverride with model_force allowed for architect', () => {
  const result = createOverride({
    target: 'model:override',
    reason: 'need opus for complex task',
    authority: 'architect',
    type: 'model_force',
    root: TMP,
  });
  assert.equal(result.type, 'model_force');
  assert.ok(result.impact.determinismBroken);
});

test('createOverride with custom expiresInMs', () => {
  const result = createOverride({
    target: 'test',
    reason: 'short override',
    authority: 'cto',
    expiresInMs: 3600000, // 1 hour
    root: TMP,
  });
  const expiresAt = new Date(result.expiresAt);
  const now = new Date();
  // Should expire within ~1 hour
  assert.ok(expiresAt > now);
  assert.ok(expiresAt - now < 3700000);
});

test('createOverride includes scope fields', () => {
  const result = createOverride({
    target: 'gate:3',
    reason: 'testing',
    authority: 'cto',
    featureSlug: 'auth',
    taskId: 'task-1',
    gate: 'gate:3',
    root: TMP,
  });
  assert.equal(result.scope.featureSlug, 'auth');
  assert.equal(result.scope.taskId, 'task-1');
  assert.equal(result.scope.gate, 'gate:3');
});

// ── revokeOverride ──

test('revokeOverride marks override as revoked', () => {
  const override = createOverride({
    target: 'gate:1',
    reason: 'test',
    authority: 'cto',
    root: TMP,
  });

  const result = revokeOverride({ overrideId: override.id, root: TMP });
  assert.equal(result.status, 'revoked');
  assert.ok(result.revokedAt);
});

test('revokeOverride persists to disk', () => {
  const override = createOverride({
    target: 'gate:2',
    reason: 'test',
    authority: 'cto',
    root: TMP,
  });

  revokeOverride({ overrideId: override.id, root: TMP });

  const filePath = join(TMP, '.ogu/overrides', `${override.id}.json`);
  const saved = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.equal(saved.status, 'revoked');
});

test('revokeOverride throws for missing override', () => {
  assert.throws(
    () => revokeOverride({ overrideId: 'nonexistent', root: TMP }),
    /not found/
  );
});

// ── listOverrides ──

test('listOverrides returns empty when no overrides', () => {
  const result = listOverrides({ root: TMP });
  assert.deepEqual(result, []);
});

test('listOverrides returns all overrides', () => {
  createOverride({ target: 'a', reason: 'test', authority: 'cto', root: TMP });
  createOverride({ target: 'b', reason: 'test', authority: 'cto', root: TMP });

  const result = listOverrides({ root: TMP });
  assert.equal(result.length, 2);
});

test('listOverrides filters by status', () => {
  const o1 = createOverride({ target: 'a', reason: 'test', authority: 'cto', root: TMP });
  createOverride({ target: 'b', reason: 'test', authority: 'cto', root: TMP });
  revokeOverride({ overrideId: o1.id, root: TMP });

  const active = listOverrides({ status: 'active', root: TMP });
  assert.equal(active.length, 1);
  assert.equal(active[0].target, 'b');

  const revoked = listOverrides({ status: 'revoked', root: TMP });
  assert.equal(revoked.length, 1);
  assert.equal(revoked[0].target, 'a');
});

test('listOverrides auto-expires old overrides', () => {
  const override = createOverride({ target: 'c', reason: 'test', authority: 'cto', root: TMP });
  // Manually set expiresAt to past
  const filePath = join(TMP, '.ogu/overrides', `${override.id}.json`);
  const record = JSON.parse(readFileSync(filePath, 'utf8'));
  record.expiresAt = '2020-01-01T00:00:00Z';
  writeFileSync(filePath, JSON.stringify(record, null, 2));

  const active = listOverrides({ status: 'active', root: TMP });
  assert.equal(active.length, 0);

  const expired = listOverrides({ status: 'expired', root: TMP });
  assert.equal(expired.length, 1);
});

test('listOverrides sorted by createdAt descending', () => {
  const o1 = createOverride({ target: 'first', reason: 'test', authority: 'cto', root: TMP });
  // Manually backdate o1 so it's clearly older
  const filePath1 = join(TMP, '.ogu/overrides', `${o1.id}.json`);
  const rec1 = JSON.parse(readFileSync(filePath1, 'utf8'));
  rec1.createdAt = '2026-02-27T00:00:00Z';
  writeFileSync(filePath1, JSON.stringify(rec1, null, 2));

  const o2 = createOverride({ target: 'second', reason: 'test', authority: 'cto', root: TMP });

  const result = listOverrides({ root: TMP });
  // Most recent first
  assert.equal(result[0].target, 'second');
  assert.equal(result[1].target, 'first');
});

// ── checkOverride ──

test('checkOverride returns active override for target', () => {
  createOverride({ target: 'gate:5', reason: 'test', authority: 'cto', root: TMP });
  const result = checkOverride({ target: 'gate:5', root: TMP });
  assert.ok(result);
  assert.equal(result.target, 'gate:5');
});

test('checkOverride returns null for no matching target', () => {
  createOverride({ target: 'gate:5', reason: 'test', authority: 'cto', root: TMP });
  const result = checkOverride({ target: 'gate:99', root: TMP });
  assert.equal(result, null);
});

test('checkOverride returns null for revoked override', () => {
  const o = createOverride({ target: 'gate:5', reason: 'test', authority: 'cto', root: TMP });
  revokeOverride({ overrideId: o.id, root: TMP });
  const result = checkOverride({ target: 'gate:5', root: TMP });
  assert.equal(result, null);
});

// Cleanup
if (origRoot === undefined) delete process.env.OGU_ROOT;
else process.env.OGU_ROOT = origRoot;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
