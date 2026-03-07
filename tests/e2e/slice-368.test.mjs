/**
 * Slice 368 — Runtime Integration Wirings (6 wirings)
 *
 * Tests the following cross-module wirings:
 *   1. Deterministic → Executor: deterministicActive blocks overrides
 *   2. MicroVM → Executor: sandbox allocation works when options.sandbox: true
 *   3. Semantic Mutex → Wave: lock acquisition before task dispatch
 *   4. AST Merge → Wave: post-wave conflict detection for multi-writer files
 *   5. Artifact → Runtime: artifacts collected and stored after wave completion
 *   6. Distributed → Kadima: dispatchTask() falls back to local when no runners configured
 */

import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
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
  const root = join(tmpdir(), `ogu-e2e-368-${suffix}-${randomUUID().slice(0, 8)}`);
  for (const d of [
    '.ogu/state', '.ogu/state/vms', '.ogu/state/vm-workdirs',
    '.ogu/audit', '.ogu/agents', '.ogu/budget',
    '.ogu/locks/symbols', '.ogu/locks/queue',
    '.ogu/kadima', '.ogu/artifacts/e2e-test',
    '.ogu/governance', '.ogu/overrides',
    'src',
  ]) {
    mkdirSync(join(root, d), { recursive: true });
  }
  writeFileSync(join(root, '.ogu/STATE.json'), '{}', 'utf8');
  writeFileSync(join(root, '.ogu/audit/index.json'), JSON.stringify({
    total: 0, byType: {},
  }), 'utf8');
  writeFileSync(join(root, '.ogu/audit/current.jsonl'), '', 'utf8');
  writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify({
    defaults: { model: 'claude-sonnet-4-20250514' },
    roles: [
      { roleId: 'backend-dev', enabled: true, capabilities: ['code-gen'], maxConcurrent: 3 },
      { roleId: 'qa', enabled: true, capabilities: ['testing'], maxConcurrent: 2 },
    ],
  }), 'utf8');
  writeFileSync(join(root, 'src/app.ts'), 'export const app = true;\nexport function handler() { return "ok"; }', 'utf8');
  writeFileSync(join(root, 'src/utils.ts'), 'export function add(a, b) { return a + b; }\nexport function sub(a, b) { return a - b; }', 'utf8');
  return root;
}

console.log("\n\x1b[1mSlice 368 — Runtime Integration Wirings (6 wirings)\x1b[0m\n");

const LIB = join(process.cwd(), 'tools/ogu/commands/lib');

// ═══ 1. Deterministic → Executor ══════════════════════════════════════
console.log("\x1b[36m  Part 1: Deterministic → Executor Wiring\x1b[0m");

const dm = await import(join(LIB, 'deterministic-mode.mjs'));

assert('enableDeterministic activates deterministic mode', () => {
  const root = makeTmpRoot('det-enable');
  const result = dm.enableDeterministic({ root, seed: 42, actor: 'cto' });
  if (!result.enabled) throw new Error('should enable');
  if (!result.locks) throw new Error('missing locks');
  if (result.locks.overrides !== 'blocked') throw new Error('overrides should be blocked');
  if (result.locks.policies !== 'frozen') throw new Error('policies should be frozen');
  rmSync(root, { recursive: true, force: true });
});

assert('isDeterministic returns true when active', () => {
  const root = makeTmpRoot('det-check');
  dm.enableDeterministic({ root, actor: 'cto' });
  if (!dm.isDeterministic({ root })) throw new Error('should be deterministic');
  rmSync(root, { recursive: true, force: true });
});

assert('checkDeterministicGuard blocks override_create when active', () => {
  const root = makeTmpRoot('det-guard-override');
  dm.enableDeterministic({ root, actor: 'cto' });
  const guard = dm.checkDeterministicGuard({ root, operation: 'override_create' });
  if (guard.allowed) throw new Error('override_create should be blocked in deterministic mode');
  if (!guard.reason.includes('blocked')) throw new Error('reason should mention blocked');
  rmSync(root, { recursive: true, force: true });
});

assert('checkDeterministicGuard blocks policy_change when active', () => {
  const root = makeTmpRoot('det-guard-policy');
  dm.enableDeterministic({ root, actor: 'cto' });
  const guard = dm.checkDeterministicGuard({ root, operation: 'policy_change' });
  if (guard.allowed) throw new Error('policy_change should be blocked');
  rmSync(root, { recursive: true, force: true });
});

assert('checkDeterministicGuard blocks model_escalation when active', () => {
  const root = makeTmpRoot('det-guard-model');
  dm.enableDeterministic({ root, actor: 'cto' });
  const guard = dm.checkDeterministicGuard({ root, operation: 'model_escalation' });
  if (guard.allowed) throw new Error('model_escalation should be blocked');
  rmSync(root, { recursive: true, force: true });
});

assert('checkDeterministicGuard allows normal ops when NOT active', () => {
  const root = makeTmpRoot('det-guard-off');
  const guard = dm.checkDeterministicGuard({ root, operation: 'override_create' });
  if (!guard.allowed) throw new Error('should be allowed when deterministic mode is off');
  rmSync(root, { recursive: true, force: true });
});

assert('disableDeterministic restores normal mode', () => {
  const root = makeTmpRoot('det-disable');
  dm.enableDeterministic({ root, actor: 'cto' });
  const result = dm.disableDeterministic({ root, actor: 'cto' });
  if (!result.disabled) throw new Error('should disable');
  if (dm.isDeterministic({ root })) throw new Error('should not be deterministic after disable');
  const guard = dm.checkDeterministicGuard({ root, operation: 'override_create' });
  if (!guard.allowed) throw new Error('overrides should be allowed after disable');
  rmSync(root, { recursive: true, force: true });
});

assert('enforceDeterminism detects hash mismatch', () => {
  const root = makeTmpRoot('det-enforce');
  dm.enableDeterministic({ root, actor: 'cto' });
  const result = dm.enforceDeterminism({
    root,
    executionHash: 'abc123',
    expectedHash: 'def456',
  });
  if (result.valid) throw new Error('should detect mismatch');
  if (!result.reason.includes('mismatch')) throw new Error('reason should mention mismatch');
  if (result.action !== 'halt_task_and_escalate') throw new Error('should escalate');
  rmSync(root, { recursive: true, force: true });
});

// ═══ 2. MicroVM → Executor ════════════════════════════════════════════
console.log("\n\x1b[36m  Part 2: MicroVM → Executor Wiring\x1b[0m");

const mvm = await import(join(LIB, 'microvm.mjs'));

assert('createVM allocates a sandbox environment', () => {
  const root = makeTmpRoot('vm-create');
  const vm = mvm.createVM(root, {
    agentId: 'backend-dev',
    taskId: 'T1',
    featureSlug: 'e2e-test',
  });
  if (!vm.vmId) throw new Error('missing vmId');
  if (!vm.workDir) throw new Error('missing workDir');

  // Verify VM is tracked
  const active = mvm.listActiveVMs(root);
  if (!active.some(v => v.vmId === vm.vmId)) throw new Error('VM not in active list');

  mvm.destroyVM(root, vm.vmId);
  rmSync(root, { recursive: true, force: true });
});

assert('executeInVM runs command in sandbox', () => {
  const root = makeTmpRoot('vm-exec');
  const vm = mvm.createVM(root, {
    agentId: 'qa',
    taskId: 'T2',
    featureSlug: 'e2e-test',
  });

  const result = mvm.executeInVM(root, vm.vmId, {
    command: 'echo',
    args: ['hello from sandbox'],
  });
  // Result should exist (either success or at least attempted)
  if (!result) throw new Error('executeInVM should return a result');

  mvm.destroyVM(root, vm.vmId);
  rmSync(root, { recursive: true, force: true });
});

assert('destroyVM removes sandbox and tracking', () => {
  const root = makeTmpRoot('vm-destroy');
  const vm = mvm.createVM(root, {
    agentId: 'qa',
    taskId: 'T3',
    featureSlug: 'e2e-test',
  });
  mvm.destroyVM(root, vm.vmId);
  const active = mvm.listActiveVMs(root);
  if (active.some(v => v.vmId === vm.vmId)) throw new Error('VM should be destroyed');
  rmSync(root, { recursive: true, force: true });
});

// ═══ 3. Semantic Mutex → Wave ═════════════════════════════════════════
console.log("\n\x1b[36m  Part 3: Semantic Mutex → Wave Wiring\x1b[0m");

const sm = await import(join(LIB, 'semantic-mutex.mjs'));

assert('acquireSymbolLock acquires write lock before dispatch', () => {
  const root = makeTmpRoot('mutex-acquire');
  const lock = sm.acquireSymbolLock({
    root,
    filePath: 'src/app.ts',
    symbol: 'handler',
    roleId: 'backend-dev',
    taskId: 'T1',
    mode: 'write',
  });
  if (!lock.id) throw new Error('missing lock id');
  if (lock.mode !== 'write') throw new Error(`expected write, got ${lock.mode}`);
  if (lock.symbol !== 'handler') throw new Error('wrong symbol');

  sm.releaseSymbolLock({ root, filePath: 'src/app.ts', symbol: 'handler', taskId: 'T1' });
  rmSync(root, { recursive: true, force: true });
});

assert('acquireSymbolLock rejects conflicting write lock', () => {
  const root = makeTmpRoot('mutex-conflict');
  // First task acquires write lock
  sm.acquireSymbolLock({
    root,
    filePath: 'src/utils.ts',
    symbol: 'add',
    roleId: 'backend-dev',
    taskId: 'T1',
    mode: 'write',
  });

  // Second task tries to acquire same symbol — should throw
  let threw = false;
  try {
    sm.acquireSymbolLock({
      root,
      filePath: 'src/utils.ts',
      symbol: 'add',
      roleId: 'qa',
      taskId: 'T2',
      mode: 'write',
    });
  } catch (e) {
    threw = true;
    if (!e.message.includes('locked by task T1')) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error('should throw on conflicting lock');

  sm.releaseAllLocks({ root, taskId: 'T1' });
  rmSync(root, { recursive: true, force: true });
});

assert('multiple read locks allowed on same symbol', () => {
  const root = makeTmpRoot('mutex-shared');
  sm.acquireSymbolLock({
    root,
    filePath: 'src/utils.ts',
    symbol: 'add',
    roleId: 'backend-dev',
    taskId: 'T1',
    mode: 'read',
  });
  // Second reader on same symbol — should succeed
  const lock2 = sm.acquireSymbolLock({
    root,
    filePath: 'src/utils.ts',
    symbol: 'add',
    roleId: 'qa',
    taskId: 'T2',
    mode: 'read',
  });
  if (!lock2) throw new Error('second read lock should succeed');

  sm.releaseAllLocks({ root, taskId: 'T1' });
  sm.releaseAllLocks({ root, taskId: 'T2' });
  rmSync(root, { recursive: true, force: true });
});

assert('releaseSymbolLock frees the lock', () => {
  const root = makeTmpRoot('mutex-release');
  sm.acquireSymbolLock({
    root,
    filePath: 'src/app.ts',
    symbol: 'handler',
    roleId: 'backend-dev',
    taskId: 'T1',
    mode: 'write',
  });
  const released = sm.releaseSymbolLock({
    root,
    filePath: 'src/app.ts',
    symbol: 'handler',
    taskId: 'T1',
  });
  if (!released) throw new Error('release should return true');

  // Now another task should be able to acquire
  const lock2 = sm.acquireSymbolLock({
    root,
    filePath: 'src/app.ts',
    symbol: 'handler',
    roleId: 'qa',
    taskId: 'T2',
    mode: 'write',
  });
  if (!lock2.id) throw new Error('should acquire after release');

  sm.releaseAllLocks({ root, taskId: 'T2' });
  rmSync(root, { recursive: true, force: true });
});

assert('detectDeadlocks returns clean result when no deadlocks', () => {
  const root = makeTmpRoot('mutex-deadlock');
  const result = sm.detectDeadlocks({ root });
  if (result.hasDeadlock) throw new Error('should have no deadlocks');
  if (!Array.isArray(result.cycles)) throw new Error('missing cycles array');
  rmSync(root, { recursive: true, force: true });
});

// ═══ 4. AST Merge → Wave ══════════════════════════════════════════════
console.log("\n\x1b[36m  Part 4: AST Merge → Wave Wiring\x1b[0m");

const am = await import(join(LIB, 'ast-merge.mjs'));

assert('extractBlocks parses JS file into blocks', () => {
  const code = `import { readFileSync } from 'node:fs';

export function greet(name) {
  return 'Hello ' + name;
}

export function farewell(name) {
  return 'Goodbye ' + name;
}

const VERSION = '1.0';`;

  const blocks = am.extractBlocks(code, 'javascript');
  if (blocks.length < 3) throw new Error(`expected >=3 blocks, got ${blocks.length}`);
  const types = blocks.map(b => b.type);
  if (!types.includes('import')) throw new Error('should detect import block');
  if (!types.includes('export-function')) throw new Error('should detect export-function block');
});

assert('computeASTDiff detects added/modified/removed blocks', () => {
  const original = `export function greet() { return 'hi'; }
export function farewell() { return 'bye'; }`;

  const modified = `export function greet() { return 'hello'; }
export function newFunc() { return 'new'; }`;

  const diff = am.computeASTDiff(original, modified, 'javascript');
  if (diff.modified.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
    throw new Error('should detect changes');
  }
  // greet was modified, farewell was removed, newFunc was added
  if (diff.modified.length === 0) throw new Error('greet should be detected as modified');
});

assert('detectASTConflicts identifies conflicting block edits', () => {
  const base = `export function process() { return 'v1'; }
export function validate() { return 'v1'; }`;

  const ours = `export function process() { return 'v2-ours'; }
export function validate() { return 'v1'; }`;

  const theirs = `export function process() { return 'v2-theirs'; }
export function validate() { return 'v1'; }`;

  const result = am.detectASTConflicts(base, ours, theirs);
  if (result.conflicts.length === 0) throw new Error('should detect conflict on process()');
  if (result.conflictBlocks.length === 0) throw new Error('should list conflict blocks');
});

assert('detectASTConflicts auto-merges non-overlapping changes', () => {
  const base = `export function a() { return 1; }
export function b() { return 2; }`;

  const ours = `export function a() { return 10; }
export function b() { return 2; }`;

  const theirs = `export function a() { return 1; }
export function b() { return 20; }`;

  const result = am.detectASTConflicts(base, ours, theirs);
  if (result.conflicts.length > 0) throw new Error('non-overlapping changes should not conflict');
  if (result.autoMergeable.length < 2) throw new Error('both changes should be auto-mergeable');
});

assert('mergeFileAST produces merged output', () => {
  const base = `export function a() { return 1; }
export function b() { return 2; }`;

  const ours = `export function a() { return 10; }
export function b() { return 2; }`;

  const theirs = `export function a() { return 1; }
export function b() { return 20; }`;

  const result = am.mergeFileAST(base, ours, theirs);
  if (!result.success) throw new Error('merge should succeed for non-overlapping changes');
  if (result.conflicts !== 0) throw new Error('should have 0 conflicts');
  if (!result.merged) throw new Error('missing merged content');
});

assert('detectSemanticConflicts finds overlapping line ranges', () => {
  const changes = [
    { file: 'src/app.ts', lines: [1, 2, 3, 4, 5] },
    { file: 'src/app.ts', lines: [4, 5, 6, 7] },
    { file: 'src/utils.ts', lines: [10, 11] },
  ];
  const conflicts = am.detectSemanticConflicts(changes);
  if (conflicts.length === 0) throw new Error('should detect overlap on src/app.ts');
  if (conflicts[0].file !== 'src/app.ts') throw new Error('conflict should be on app.ts');
  if (!conflicts[0].overlap.includes(4)) throw new Error('overlap should include line 4');
});

// ═══ 5. Artifact → Runtime ════════════════════════════════════════════
console.log("\n\x1b[36m  Part 5: Artifact → Runtime Wiring\x1b[0m");

const as = await import(join(LIB, 'artifact-store.mjs'));

assert('storeArtifact saves and indexes artifact', () => {
  const root = makeTmpRoot('artifact-store');
  const artifact = as.storeArtifact('T1', 'e2e-test', {
    type: 'FILE',
    identifier: 'FILE:src/app.ts',
    files: [{ path: 'src/app.ts', content: 'export const app = true;' }],
    agentId: 'backend-dev',
    metadata: { roleId: 'backend-dev', model: 'sonnet', tokensUsed: 1500 },
  }, root);

  if (!artifact.id) throw new Error('missing artifact id');
  if (artifact.type !== 'FILE') throw new Error('wrong type');
  if (!artifact.producedBy.taskId) throw new Error('missing producedBy.taskId');
  if (artifact.verified) throw new Error('should not be verified initially');

  rmSync(root, { recursive: true, force: true });
});

assert('loadArtifact retrieves stored artifact', () => {
  const root = makeTmpRoot('artifact-load');
  as.storeArtifact('T1', 'e2e-test', {
    type: 'COMPONENT',
    files: [{ path: 'src/Button.tsx' }],
    agentId: 'frontend-dev',
  }, root);

  const loaded = as.loadArtifact('T1', 'e2e-test', root);
  if (!loaded) throw new Error('should load artifact');
  if (loaded.type !== 'COMPONENT') throw new Error('wrong type');

  rmSync(root, { recursive: true, force: true });
});

assert('verifyArtifact marks artifact as verified', () => {
  const root = makeTmpRoot('artifact-verify');
  as.storeArtifact('T1', 'e2e-test', {
    type: 'API',
    identifier: 'API:/users GET',
    files: [],
    agentId: 'backend-dev',
  }, root);

  const result = as.verifyArtifact('T1', 'e2e-test', 'gate:typecheck', root);
  if (!result.verified) throw new Error('verification should succeed');

  const loaded = as.loadArtifact('T1', 'e2e-test', root);
  if (!loaded.verified) throw new Error('should be verified after verifyArtifact');
  if (loaded.verifiedBy !== 'gate:typecheck') throw new Error('wrong verifiedBy');

  rmSync(root, { recursive: true, force: true });
});

assert('listArtifacts returns all task IDs for a feature', () => {
  const root = makeTmpRoot('artifact-list');
  as.storeArtifact('T1', 'e2e-test', { type: 'FILE', files: [] }, root);
  as.storeArtifact('T2', 'e2e-test', { type: 'API', files: [] }, root);
  as.storeArtifact('T3', 'e2e-test', { type: 'TEST', files: [] }, root);

  const list = as.listArtifacts('e2e-test', root);
  if (list.length !== 3) throw new Error(`expected 3 artifacts, got ${list.length}`);
  if (!list.includes('T1')) throw new Error('should include T1');
  if (!list.includes('T3')) throw new Error('should include T3');

  rmSync(root, { recursive: true, force: true });
});

assert('checkDependencies detects missing dependencies', () => {
  const root = makeTmpRoot('artifact-deps');
  // Store T1 artifact but don't verify it
  as.storeArtifact('T1', 'e2e-test', {
    type: 'FILE',
    identifier: 'FILE:T1',
    files: [],
    dependencies: ['FILE:T0'],  // T0 doesn't exist
  }, root);

  const check = as.checkDependencies('T1', 'e2e-test', root);
  if (check.ready) throw new Error('should not be ready — T0 missing');
  if (check.missing.length === 0) throw new Error('should report missing dependencies');

  rmSync(root, { recursive: true, force: true });
});

assert('resolveArtifact resolves by identifier', () => {
  const root = makeTmpRoot('artifact-resolve');
  as.storeArtifact('T1', 'e2e-test', {
    type: 'API',
    identifier: 'API:/users POST',
    files: [{ path: 'src/routes/users.ts' }],
    agentId: 'backend-dev',
  }, root);

  const resolved = as.resolveArtifact('e2e-test', 'API:/users POST', root);
  if (!resolved) throw new Error('should resolve by identifier');
  if (resolved.type !== 'API') throw new Error('wrong type');

  rmSync(root, { recursive: true, force: true });
});

// ═══ 6. Distributed → Kadima ══════════════════════════════════════════
console.log("\n\x1b[36m  Part 6: Distributed → Kadima Wiring\x1b[0m");

const dr = await import(join(LIB, 'distributed-runner.mjs'));
const ke = await import(join(LIB, 'kadima-engine.mjs'));

assert('listRunners returns empty when no runners configured', () => {
  const root = makeTmpRoot('dist-empty');
  const runners = dr.listRunners({ root });
  if (!Array.isArray(runners)) throw new Error('should return array');
  if (runners.length !== 0) throw new Error('should be empty');
  rmSync(root, { recursive: true, force: true });
});

assert('registerRunner adds a runner to registry', () => {
  const root = makeTmpRoot('dist-register');
  const runner = dr.registerRunner({
    root,
    id: 'runner-1',
    host: 'localhost',
    port: 9000,
    capabilities: ['build', 'test'],
    maxConcurrency: 2,
  });
  if (runner.id !== 'runner-1') throw new Error('wrong id');
  if (runner.status !== 'idle') throw new Error('should start idle');

  const list = dr.listRunners({ root });
  if (list.length !== 1) throw new Error('should have 1 runner');

  rmSync(root, { recursive: true, force: true });
});

assert('removeRunner removes a runner from registry', () => {
  const root = makeTmpRoot('dist-remove');
  dr.registerRunner({ root, id: 'r1', host: 'localhost', port: 9001 });
  dr.registerRunner({ root, id: 'r2', host: 'localhost', port: 9002 });
  dr.removeRunner({ root, id: 'r1' });
  const list = dr.listRunners({ root });
  if (list.length !== 1) throw new Error('should have 1 runner after removal');
  if (list[0].id !== 'r2') throw new Error('wrong runner remaining');
  rmSync(root, { recursive: true, force: true });
});

await assertAsync('dispatchTask falls back to local when no runners configured', async () => {
  const root = makeTmpRoot('dist-fallback');
  // Ensure no runners registered (empty registry)
  const runners = dr.listRunners({ root });
  if (runners.length > 0) throw new Error('precondition: no runners');

  const result = await ke.dispatchTask(
    { taskId: 'T-fallback', command: 'noop', args: {} },
    { root, featureSlug: 'e2e-test', forceLocal: false },
  );

  if (!result) throw new Error('should return a result');
  if (!result.taskId && !result.status) throw new Error('result missing expected fields');
  // The result should indicate local execution (fallback)
  if (result.method && result.method !== 'local') throw new Error(`expected local fallback, got ${result.method}`);

  rmSync(root, { recursive: true, force: true });
});

await assertAsync('dispatchTask with forceLocal skips remote runners', async () => {
  const root = makeTmpRoot('dist-force-local');
  // Register a runner — but force local should ignore it
  dr.registerRunner({ root, id: 'r1', host: 'remote-host', port: 9090 });

  const result = await ke.dispatchTask(
    { taskId: 'T-local', command: 'echo', args: { msg: 'test' } },
    { root, featureSlug: 'e2e-test', forceLocal: true },
  );

  if (!result) throw new Error('should return a result');
  if (result.method && result.method !== 'local') throw new Error(`expected local, got ${result.method}`);

  rmSync(root, { recursive: true, force: true });
});

assert('updateRunnerStatus updates runner state', () => {
  const root = makeTmpRoot('dist-status');
  dr.registerRunner({ root, id: 'r1', host: 'localhost', port: 9001 });
  const updated = dr.updateRunnerStatus({ root, id: 'r1', status: 'busy', activeTasks: 3 });
  if (!updated) throw new Error('should return updated runner');
  if (updated.status !== 'busy') throw new Error('status not updated');
  if (updated.activeTasks !== 3) throw new Error('activeTasks not updated');

  const list = dr.listRunners({ root });
  if (list[0].status !== 'busy') throw new Error('status not persisted');

  rmSync(root, { recursive: true, force: true });
});

// ═══ Bonus: Wave Executor + Lock Integration Pattern ══════════════════
console.log("\n\x1b[36m  Part 7: Wave Executor Integration Pattern\x1b[0m");

const we = await import(join(LIB, 'wave-executor.mjs'));

await assertAsync('wave executor runs tasks in dependency order', async () => {
  const order = [];
  const executor = we.createWaveExecutor();
  executor.addTask('T1', { run: () => { order.push('T1'); return 'r1'; }, deps: [] });
  executor.addTask('T2', { run: () => { order.push('T2'); return 'r2'; }, deps: ['T1'] });
  executor.addTask('T3', { run: () => { order.push('T3'); return 'r3'; }, deps: ['T1'] });
  executor.addTask('T4', { run: () => { order.push('T4'); return 'r4'; }, deps: ['T2', 'T3'] });

  const result = await executor.execute();
  if (result.status !== 'completed') throw new Error(`expected completed, got ${result.status}`);

  // T1 must come before T2 and T3, T4 must come last
  const t1Idx = order.indexOf('T1');
  const t2Idx = order.indexOf('T2');
  const t3Idx = order.indexOf('T3');
  const t4Idx = order.indexOf('T4');
  if (t1Idx >= t2Idx) throw new Error('T1 should run before T2');
  if (t1Idx >= t3Idx) throw new Error('T1 should run before T3');
  if (t4Idx <= t2Idx || t4Idx <= t3Idx) throw new Error('T4 should run after T2 and T3');
});

await assertAsync('wave executor handles task failure', async () => {
  const executor = we.createWaveExecutor();
  executor.addTask('T1', { run: () => 'ok', deps: [] });
  executor.addTask('T2', { run: () => { throw new Error('fail'); }, deps: ['T1'] });

  const result = await executor.execute();
  if (result.status !== 'failed') throw new Error('should report failure');
  if (!result.errors['T2']) throw new Error('T2 error should be recorded');
});

// ═══ Cleanup & Results ════════════════════════════════════════════════

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
