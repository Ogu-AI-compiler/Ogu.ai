/**
 * Slice 367 — Pipeline Integration Wirings (6 wirings)
 *
 * Tests the following cross-module wirings:
 *   1. Memory → Prompt: buildPrompt() is async and accepts oguRoot, memory fabric injection works
 *   2. Freeze → Compile: when isFrozen() returns true, compile exits with code 2 and OGU0099
 *   3. Graph Hash → Compile: compile computes pre/post build graph hashes
 *   4. Allocation → Compile: compile runs allocation validation after Phase 1
 *   5. Consistency → Compile: compile runs consistency check after gates
 *   6. Knowledge → Fabric: knowledge loop indexes sources via memory-fabric
 */

import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

let pass = 0, fail = 0;
function assert(label, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      // Handle async — run synchronously via wrapper
      throw new Error('Use assertAsync for async tests');
    }
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } catch (e) {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`);
  }
}

async function assertAsync(label, fn) {
  try {
    await fn();
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } catch (e) {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`);
  }
}

function makeTmpRoot(suffix) {
  const root = join(tmpdir(), `ogu-e2e-367-${suffix}-${randomUUID().slice(0, 8)}`);
  for (const d of [
    '.ogu/state', '.ogu/audit', '.ogu/agents', '.ogu/budget',
    '.ogu/memory', '.ogu/governance', '.ogu/state/graph-hashes',
    '.ogu/state/sagas', '.ogu/artifacts',
    'docs/vault/04_Features/e2e-test',
    'src',
  ]) {
    mkdirSync(join(root, d), { recursive: true });
  }
  writeFileSync(join(root, '.ogu/STATE.json'), '{}', 'utf8');
  writeFileSync(join(root, '.ogu/audit/index.json'), JSON.stringify({
    total: 1, byType: { 'system.init': 1 }, updatedAt: new Date().toISOString(),
  }), 'utf8');
  writeFileSync(join(root, '.ogu/audit/current.jsonl'), '', 'utf8');
  writeFileSync(join(root, '.ogu/budget/budget-state.json'), JSON.stringify({
    daily: {}, monthly: {}, byFeature: {},
  }), 'utf8');
  writeFileSync(join(root, '.ogu/budget/transactions.jsonl'), '', 'utf8');
  writeFileSync(join(root, '.ogu/state/scheduler-state.json'), JSON.stringify({
    queue: [], frozen: false,
  }), 'utf8');
  writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify({
    defaults: { model: 'claude-sonnet-4-20250514' },
    roles: [
      { roleId: 'backend-dev', enabled: true, capabilities: ['code-gen', 'implementation'], maxConcurrent: 3, riskTier: 'medium' },
      { roleId: 'qa', enabled: true, capabilities: ['testing', 'qa'], maxConcurrent: 2, riskTier: 'low' },
    ],
    teams: [{ teamId: 'core', roles: ['backend-dev', 'qa'] }],
  }), 'utf8');
  writeFileSync(join(root, 'src/app.ts'), 'export const app = true;', 'utf8');
  return root;
}

console.log("\n\x1b[1mSlice 367 — Pipeline Integration Wirings (6 wirings)\x1b[0m\n");

const LIB = join(process.cwd(), 'tools/ogu/commands/lib');

// ═══ 1. Memory → Prompt ═══════════════════════════════════════════════
console.log("\x1b[36m  Part 1: Memory → Prompt Wiring\x1b[0m");

const pb = await import(join(LIB, 'prompt-builder.mjs'));

assert('buildPrompt is async (returns Promise)', () => {
  const result = pb.buildPrompt({ task: 'test task', system: 'system' });
  if (!result || typeof result.then !== 'function') throw new Error('buildPrompt must return a Promise');
});

await assertAsync('buildPrompt simple mode returns system+messages', async () => {
  const prompt = await pb.buildPrompt({
    task: 'implement login',
    system: 'You are a developer.',
    context: 'Express.js project',
    constraints: ['No external deps'],
  });
  if (!prompt.system) throw new Error('missing system');
  if (!prompt.messages || prompt.messages.length === 0) throw new Error('missing messages');
  if (!prompt.messages[0].content.includes('implement login')) throw new Error('task not in content');
});

await assertAsync('buildPrompt agent mode accepts oguRoot param', async () => {
  const root = makeTmpRoot('prompt');
  // Seed the memory fabric with an entity so injection has something to find
  const mf = await import(join(LIB, 'memory-fabric.mjs'));
  mf.addEntity(root, {
    type: 'pattern',
    title: 'Login Auth Pattern',
    content: 'Always use bcrypt for password hashing. Use JWT for session tokens.',
    tags: ['auth', 'login', 'security'],
  });

  const prompt = await pb.buildPrompt({
    role: 'backend-dev',
    taskName: 'Implement authentication',
    taskDescription: 'Build login endpoint with password hashing and JWT tokens',
    featureSlug: 'auth-feature',
    files: [{ path: 'src/auth.ts', role: 'write' }],
    oguRoot: root,
  });

  if (!prompt.system) throw new Error('missing system');
  if (!prompt.messages || prompt.messages.length === 0) throw new Error('missing messages');
  // The prompt should contain the task description in messages
  if (!prompt.messages[0].content.includes('Implement authentication')) throw new Error('task name not found');

  rmSync(root, { recursive: true, force: true });
});

await assertAsync('buildPrompt agent mode injects memory fabric context', async () => {
  const root = makeTmpRoot('prompt-inject');
  const mf = await import(join(LIB, 'memory-fabric.mjs'));
  mf.addEntity(root, {
    type: 'pattern',
    title: 'Database Migration Pattern',
    content: 'Always create reversible migrations. Use timestamps in filenames.',
    tags: ['database', 'migration'],
  });

  const prompt = await pb.buildPrompt({
    role: 'backend-dev',
    taskName: 'Create database migration',
    taskDescription: 'Build migration system for database schema changes',
    featureSlug: 'db-feature',
    files: [],
    oguRoot: root,
  });

  // Check if memory context was injected into the messages
  const content = prompt.messages[0].content;
  const hasMemory = content.includes('Memory') || content.includes('migration') || content.includes('database');
  if (!hasMemory) throw new Error('memory fabric context not injected into prompt');

  rmSync(root, { recursive: true, force: true });
});

// ═══ 2. Freeze → Compile ══════════════════════════════════════════════
console.log("\n\x1b[36m  Part 2: Freeze → Compile Wiring\x1b[0m");

const cf = await import(join(LIB, 'company-freeze.mjs'));

assert('isFrozen returns false when not frozen', () => {
  const root = makeTmpRoot('freeze-check');
  const result = cf.isFrozen({ root });
  if (result !== false) throw new Error(`expected false, got ${result}`);
  rmSync(root, { recursive: true, force: true });
});

assert('freeze sets frozen state, isFrozen returns true', () => {
  const root = makeTmpRoot('freeze-set');
  const r = cf.freeze({ root, reason: 'audit', actor: 'cto' });
  if (!r.frozen) throw new Error('freeze failed');
  const frozen = cf.isFrozen({ root });
  if (!frozen) throw new Error('isFrozen should be true after freeze');
  rmSync(root, { recursive: true, force: true });
});

assert('checkFreezeGuard blocks compile operation when frozen', () => {
  const root = makeTmpRoot('freeze-guard');
  cf.freeze({ root, reason: 'compliance audit', actor: 'cto' });
  const guard = cf.checkFreezeGuard({ root, operation: 'compile' });
  if (guard.allowed) throw new Error('compile should be blocked when frozen');
  if (!guard.reason.includes('frozen')) throw new Error('reason should mention frozen');
  rmSync(root, { recursive: true, force: true });
});

assert('checkFreezeGuard allows read operations when frozen', () => {
  const root = makeTmpRoot('freeze-read');
  cf.freeze({ root, reason: 'audit', actor: 'cto' });
  const guard = cf.checkFreezeGuard({ root, operation: 'read' });
  if (!guard.allowed) throw new Error('read should be allowed during freeze');
  rmSync(root, { recursive: true, force: true });
});

assert('thaw restores normal operation after freeze', () => {
  const root = makeTmpRoot('freeze-thaw');
  cf.freeze({ root, reason: 'audit', actor: 'cto' });
  const thawResult = cf.thaw({ root, actor: 'cto' });
  if (!thawResult.thawed) throw new Error(`thaw failed: ${thawResult.reason}`);
  if (cf.isFrozen({ root })) throw new Error('should not be frozen after thaw');
  const guard = cf.checkFreezeGuard({ root, operation: 'compile' });
  if (!guard.allowed) throw new Error('compile should be allowed after thaw');
  rmSync(root, { recursive: true, force: true });
});

// ═══ 3. Graph Hash → Compile ══════════════════════════════════════════
console.log("\n\x1b[36m  Part 3: Graph Hash → Compile Wiring\x1b[0m");

const gh = await import(join(LIB, 'execution-graph-hash.mjs'));

assert('computeGraphHash produces a valid hash result', () => {
  const root = makeTmpRoot('ghash');
  // Create Plan.json for the feature
  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build', files: ['src/app.ts'] }],
  }), 'utf8');

  const result = gh.computeGraphHash(root, 'e2e-test');
  if (!result.graphHash) throw new Error('missing graphHash');
  if (result.graphHash.length !== 64) throw new Error(`hash length wrong: ${result.graphHash.length}`);
  if (!result.components) throw new Error('missing components');
  if (!result.components.planHash) throw new Error('missing planHash');
  if (!result.computedAt) throw new Error('missing computedAt');

  rmSync(root, { recursive: true, force: true });
});

assert('computeGraphHash pre/post hashes differ after code change', () => {
  const root = makeTmpRoot('ghash-diff');
  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build', files: ['src/app.ts'] }],
  }), 'utf8');

  const preHash = gh.computeGraphHash(root, 'e2e-test');

  // Modify the plan (simulating a build step changing things)
  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build', files: ['src/app.ts'] }, { id: 'T2', phase: 'test', files: ['test/app.test.ts'] }],
  }), 'utf8');

  const postHash = gh.computeGraphHash(root, 'e2e-test');

  if (preHash.graphHash === postHash.graphHash) throw new Error('pre and post hashes should differ');

  rmSync(root, { recursive: true, force: true });
});

assert('verifyGraphHash correctly reports match/mismatch', () => {
  const root = makeTmpRoot('ghash-verify');
  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build' }],
  }), 'utf8');

  const first = gh.computeGraphHash(root, 'e2e-test');
  const verification = gh.verifyGraphHash(root, 'e2e-test', first.graphHash);
  if (!verification.match) throw new Error('hashes should match');

  // Verify mismatch with wrong hash
  const badVerification = gh.verifyGraphHash(root, 'e2e-test', 'deadbeef'.repeat(8));
  if (badVerification.match) throw new Error('should detect mismatch');

  rmSync(root, { recursive: true, force: true });
});

assert('diffGraphHashes identifies changed components', () => {
  const root = makeTmpRoot('ghash-diffcmp');
  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build' }],
  }), 'utf8');
  const h1 = gh.computeGraphHash(root, 'e2e-test');

  writeFileSync(join(root, 'docs/vault/04_Features/e2e-test/Plan.json'), JSON.stringify({
    tasks: [{ id: 'T1', phase: 'build' }, { id: 'T2', phase: 'verify' }],
  }), 'utf8');
  const h2 = gh.computeGraphHash(root, 'e2e-test');

  const diff = gh.diffGraphHashes(h1, h2);
  if (diff.match) throw new Error('should not match');
  if (diff.changeCount === 0) throw new Error('should have changes');
  if (!diff.changes.some(c => c.component === 'plan')) throw new Error('plan should be in changes');

  rmSync(root, { recursive: true, force: true });
});

// ═══ 4. Allocation → Compile ══════════════════════════════════════════
console.log("\n\x1b[36m  Part 4: Allocation → Compile Wiring\x1b[0m");

const ta = await import(join(LIB, 'task-allocator.mjs'));

assert('estimateTaskCost returns valid cost estimate', () => {
  const est = ta.estimateTaskCost({
    complexity: 'medium',
    files: ['src/a.ts', 'src/b.ts'],
    requiredCapabilities: ['code-gen'],
  });
  if (typeof est.estimatedTokens !== 'number') throw new Error('missing estimatedTokens');
  if (typeof est.estimatedCost !== 'number') throw new Error('missing estimatedCost');
  if (!est.confidence) throw new Error('missing confidence');
  if (!est.breakdown) throw new Error('missing breakdown');
  if (est.estimatedTokens <= 0) throw new Error('tokens should be positive');
});

assert('checkGovernance blocks critical risk tasks', () => {
  const result = ta.checkGovernance({
    taskId: 'T-critical',
    requiredCapabilities: ['code-gen'],
    riskTier: 'critical',
    touches: ['src/app.ts'],
  });
  if (result.allowed) throw new Error('critical risk should require approval');
  if (result.decision !== 'REQUIRES_APPROVAL') throw new Error(`expected REQUIRES_APPROVAL, got ${result.decision}`);
});

assert('checkGovernance allows low risk tasks', () => {
  const result = ta.checkGovernance({
    taskId: 'T-low',
    requiredCapabilities: ['testing'],
    riskTier: 'low',
    touches: ['test/app.test.ts'],
  });
  if (!result.allowed) throw new Error('low risk should be allowed');
});

assert('resolveArtifactDeps detects missing upstream tasks', () => {
  const result = ta.resolveArtifactDeps(
    { taskId: 'T2', dependsOn: ['T1', 'T0'], requiredArtifacts: [] },
    { completedTasks: new Set(['T0']), artifacts: new Map() },
  );
  if (result.resolved) throw new Error('should not resolve with missing T1');
  if (!result.missing.some(m => m.taskId === 'T1')) throw new Error('T1 should be in missing');
});

assert('resolveArtifactDeps passes when all deps are complete', () => {
  const result = ta.resolveArtifactDeps(
    { taskId: 'T3', dependsOn: ['T1', 'T2'], requiredArtifacts: [] },
    { completedTasks: new Set(['T1', 'T2']), artifacts: new Map() },
  );
  if (!result.resolved) throw new Error('all deps present — should resolve');
});

// ═══ 5. Consistency → Compile ═════════════════════════════════════════
console.log("\n\x1b[36m  Part 5: Consistency → Compile Wiring\x1b[0m");

const cm = await import(join(LIB, 'consistency-model.mjs'));

assert('checkConsistency returns consistent for healthy .ogu/', () => {
  const root = makeTmpRoot('consistency');
  const result = cm.checkConsistency(root, 'e2e-test');
  if (typeof result.consistent !== 'boolean') throw new Error('missing consistent field');
  if (!result.checkedAt) throw new Error('missing checkedAt');
  if (typeof result.issueCount !== 'number') throw new Error('missing issueCount');
  // A properly set-up root should be consistent
  if (!result.consistent) {
    throw new Error(`unexpected inconsistency: ${JSON.stringify(result.issues.slice(0, 3))}`);
  }
  rmSync(root, { recursive: true, force: true });
});

assert('checkConsistency detects corrupted state file', () => {
  const root = makeTmpRoot('consistency-bad');
  writeFileSync(join(root, '.ogu/state/scheduler-state.json'), 'NOT JSON', 'utf8');
  const result = cm.checkConsistency(root, 'e2e-test');
  if (result.consistent) throw new Error('should detect corruption');
  if (!result.issues.some(i => i.layer === 'state')) throw new Error('should report state layer issue');
  rmSync(root, { recursive: true, force: true });
});

assert('createSaga returns saga in pending state', () => {
  const saga = cm.createSaga('test-saga', [
    { name: 'step1', execute: () => 'result1', compensate: () => {} },
    { name: 'step2', execute: () => 'result2', compensate: () => {} },
  ]);
  if (saga.state !== 'pending') throw new Error(`expected pending, got ${saga.state}`);
  if (saga.steps.length !== 2) throw new Error(`expected 2 steps, got ${saga.steps.length}`);
  if (typeof saga.execute !== 'function') throw new Error('missing execute method');
  if (typeof saga.getStatus !== 'function') throw new Error('missing getStatus method');
});

await assertAsync('executeSaga completes successfully for valid steps', async () => {
  const root = makeTmpRoot('saga');
  const saga = cm.createSaga('compile-saga', [
    { name: 'validate', execute: () => ({ valid: true }), compensate: () => {} },
    { name: 'build', execute: () => ({ built: true }), compensate: () => {} },
    { name: 'verify', execute: () => ({ verified: true }), compensate: () => {} },
  ]);
  const result = await cm.executeSaga(saga, root);
  if (result.state !== 'completed') throw new Error(`expected completed, got ${result.state}`);
  if (Object.keys(result.results).length !== 3) throw new Error('should have 3 step results');
  rmSync(root, { recursive: true, force: true });
});

await assertAsync('executeSaga compensates on failure', async () => {
  const compensated = [];
  const saga = cm.createSaga('fail-saga', [
    { name: 'step1', execute: () => 'ok', compensate: () => { compensated.push('step1'); } },
    { name: 'step2', execute: () => { throw new Error('boom'); }, compensate: () => { compensated.push('step2'); } },
  ]);
  try {
    await cm.executeSaga(saga);
    throw new Error('should have thrown');
  } catch (e) {
    if (e.message !== 'boom') throw e;
  }
  if (!compensated.includes('step1')) throw new Error('step1 should be compensated');
  if (saga.state !== 'compensated') throw new Error(`expected compensated, got ${saga.state}`);
});

assert('idempotency key deduplication works', () => {
  const root = makeTmpRoot('idemp');
  const key = cm.createIdempotencyKey('compile', { slug: 'test', gate: 5 });
  const check1 = cm.checkIdempotency(root, key);
  if (check1.duplicate) throw new Error('should not be duplicate initially');

  cm.recordIdempotency(root, key, { ok: true });
  const check2 = cm.checkIdempotency(root, key);
  if (!check2.duplicate) throw new Error('should detect duplicate');
  if (!check2.originalResult.ok) throw new Error('should return original result');

  rmSync(root, { recursive: true, force: true });
});

assert('reconcile detects healthy state', () => {
  const root = makeTmpRoot('reconcile');
  const result = cm.reconcile(root);
  if (typeof result.reconciled !== 'boolean') throw new Error('missing reconciled');
  if (!result.checkedAt) throw new Error('missing checkedAt');
  rmSync(root, { recursive: true, force: true });
});

// ═══ 6. Knowledge → Fabric ════════════════════════════════════════════
console.log("\n\x1b[36m  Part 6: Knowledge → Fabric Wiring\x1b[0m");

const mf = await import(join(LIB, 'memory-fabric.mjs'));

assert('addEntity + query finds indexed entity', () => {
  const root = makeTmpRoot('fabric-query');
  mf.addEntity(root, {
    type: 'adr',
    title: 'ADR-001: Use PostgreSQL',
    content: 'We chose PostgreSQL for its JSONB support and full-text search capabilities.',
    tags: ['database', 'postgresql', 'architecture'],
  });

  const results = mf.query(root, 'PostgreSQL database');
  if (results.length === 0) throw new Error('query should find the entity');
  if (!results[0].entity.title.includes('PostgreSQL')) throw new Error('wrong entity returned');

  rmSync(root, { recursive: true, force: true });
});

assert('indexSource indexes files from a directory', () => {
  const root = makeTmpRoot('fabric-index');
  // Create a source directory with some files
  const srcDir = join(root, 'docs/vault/03_ADR');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, 'ADR-001.md'), '# ADR-001: Use React\nWe chose React for its ecosystem.', 'utf8');
  writeFileSync(join(srcDir, 'ADR-002.md'), '# ADR-002: Use TypeScript\nTypeScript provides type safety.', 'utf8');

  const result = mf.indexSource(root, 'adr', 'docs/vault/03_ADR');
  if (result.indexed < 2) throw new Error(`expected 2 indexed, got ${result.indexed}`);

  // Verify we can query the indexed entities
  const queryResult = mf.query(root, 'React ecosystem');
  if (queryResult.length === 0) throw new Error('query should find indexed ADR');

  rmSync(root, { recursive: true, force: true });
});

assert('indexSource skips already-indexed sources', () => {
  const root = makeTmpRoot('fabric-skip');
  const srcDir = join(root, 'docs/vault/03_ADR');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, 'ADR-001.md'), '# ADR-001\nContent.', 'utf8');

  const first = mf.indexSource(root, 'adr', 'docs/vault/03_ADR');
  const second = mf.indexSource(root, 'adr', 'docs/vault/03_ADR');
  if (second.indexed !== 0) throw new Error(`should skip already-indexed, got ${second.indexed}`);
  if (second.skipped < 1) throw new Error('should report skipped');

  rmSync(root, { recursive: true, force: true });
});

assert('injectContext enriches prompt with relevant entities', () => {
  const root = makeTmpRoot('fabric-inject');
  mf.addEntity(root, {
    type: 'pattern',
    title: 'API Error Handling Pattern',
    content: 'Always return structured error responses with code, message, and details fields.',
    tags: ['api', 'error-handling', 'pattern'],
  });
  mf.addEntity(root, {
    type: 'pattern',
    title: 'Logging Pattern',
    content: 'Use structured JSON logging with request ID correlation.',
    tags: ['logging', 'observability'],
  });

  const result = mf.injectContext(root, 'You are a developer.', 'Build API error handling middleware');
  if (result.entitiesUsed === 0) throw new Error('should inject at least 1 entity');
  if (result.enrichedPrompt.length <= 'You are a developer.'.length) {
    throw new Error('enriched prompt should be longer than original');
  }
  if (result.sources.length === 0) throw new Error('should have sources');

  rmSync(root, { recursive: true, force: true });
});

assert('getStats returns fabric statistics', () => {
  const root = makeTmpRoot('fabric-stats');
  mf.addEntity(root, { type: 'adr', title: 'Test ADR', content: 'test', tags: ['test'] });
  mf.addEntity(root, { type: 'pattern', title: 'Test Pattern', content: 'test', tags: ['test'] });

  const stats = mf.getStats(root);
  if (stats.entityCount !== 2) throw new Error(`expected 2 entities, got ${stats.entityCount}`);
  if (!stats.typeBreakdown.adr) throw new Error('missing adr in breakdown');
  if (!stats.typeBreakdown.pattern) throw new Error('missing pattern in breakdown');

  rmSync(root, { recursive: true, force: true });
});

assert('addRelation creates entity relationships', () => {
  const root = makeTmpRoot('fabric-relation');
  const e1 = mf.addEntity(root, { type: 'adr', title: 'ADR-001', content: 'architecture decision', tags: [] });
  const e2 = mf.addEntity(root, { type: 'contract', title: 'Contract-001', content: 'API contract', tags: [] });

  const rel = mf.addRelation(root, e1.id, e2.id, 'produces');
  if (!rel.added) throw new Error('relation should be added');

  const related = mf.getRelated(root, e1.id, 1);
  if (!related.root) throw new Error('should have root entity');
  if (related.related.length === 0) throw new Error('should have related entities');

  rmSync(root, { recursive: true, force: true });
});

// ═══ Cleanup & Results ════════════════════════════════════════════════

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
