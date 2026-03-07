/**
 * Slice 411 — Orchestrator Interface
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 411 — Orchestrator Interface\x1b[0m\n');

const { createOrchestrator, LocalOrchestrator, FlyOrchestrator } =
  await import('../../tools/studio/server/infra/orchestrator.mjs');

delete process.env.DEPLOYMENT_MODE;

assert('createOrchestrator returns LocalOrchestrator by default', () => {
  const orch = createOrchestrator();
  if (!(orch instanceof LocalOrchestrator)) throw new Error('should be LocalOrchestrator');
});

assert('createOrchestrator returns FlyOrchestrator when DEPLOYMENT_MODE=fly', () => {
  process.env.DEPLOYMENT_MODE = 'fly';
  const orch = createOrchestrator();
  if (!(orch instanceof FlyOrchestrator)) throw new Error('should be FlyOrchestrator');
  delete process.env.DEPLOYMENT_MODE;
});

await assertAsync('LocalOrchestrator.getOrCreateWorkspace returns workspace info', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const userId = `orch-test-${randomUUID().slice(0, 8)}`;
  const info = await orch.getOrCreateWorkspace(userId);
  if (!info.path) throw new Error('no path in workspace info');
  if (!info.userId) throw new Error('no userId in workspace info');
  if (info.mode !== 'local') throw new Error(`expected 'local', got '${info.mode}'`);
  // Cleanup
  rmSync(info.path, { recursive: true, force: true });
});

await assertAsync('LocalOrchestrator.getWorkspaceStatus returns running for existing workspace', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const userId = `orch-status-${randomUUID().slice(0, 8)}`;
  const info = await orch.getOrCreateWorkspace(userId);
  const status = await orch.getWorkspaceStatus(userId);
  if (status !== 'running') throw new Error(`expected 'running', got '${status}'`);
  rmSync(info.path, { recursive: true, force: true });
});

await assertAsync('LocalOrchestrator.getWorkspaceStatus returns none for non-existent', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const status = await orch.getWorkspaceStatus(`nonexistent-user-${randomUUID()}`);
  if (status !== 'none') throw new Error(`expected 'none', got '${status}'`);
});

await assertAsync('LocalOrchestrator.suspendWorkspace is no-op', async () => {
  const orch = new LocalOrchestrator();
  // Should not throw
  await orch.suspendWorkspace('any-user');
});

await assertAsync('LocalOrchestrator.resumeWorkspace is no-op', async () => {
  const orch = new LocalOrchestrator();
  // Should not throw
  await orch.resumeWorkspace('any-user');
});

await assertAsync('FlyOrchestrator.getWorkspaceStatus returns none (stub)', async () => {
  process.env.DEPLOYMENT_MODE = 'fly';
  const orch = new FlyOrchestrator();
  const status = await orch.getWorkspaceStatus('any-user');
  if (status !== 'none') throw new Error(`expected 'none' (stub), got '${status}'`);
  delete process.env.DEPLOYMENT_MODE;
});

await assertAsync('FlyOrchestrator.getOrCreateWorkspace returns /home/user path', async () => {
  process.env.DEPLOYMENT_MODE = 'fly';
  const orch = new FlyOrchestrator();
  const info = await orch.getOrCreateWorkspace('fly-user-test');
  if (info.path !== '/home/user') throw new Error(`expected /home/user, got ${info.path}`);
  if (info.mode !== 'fly') throw new Error(`expected 'fly', got '${info.mode}'`);
  delete process.env.DEPLOYMENT_MODE;
});

assert('orchestrator interface has all required methods', () => {
  const orch = createOrchestrator();
  const required = ['getOrCreateWorkspace', 'suspendWorkspace', 'resumeWorkspace', 'getWorkspaceStatus'];
  for (const m of required) {
    if (typeof orch[m] !== 'function') throw new Error(`missing method: ${m}`);
  }
});

await assertAsync('local mode: two users get different workspace paths', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const u1 = `u1-${randomUUID().slice(0, 8)}`;
  const u2 = `u2-${randomUUID().slice(0, 8)}`;
  const w1 = await orch.getOrCreateWorkspace(u1);
  const w2 = await orch.getOrCreateWorkspace(u2);
  if (w1.path === w2.path) throw new Error('workspace paths must differ');
  rmSync(w1.path, { recursive: true, force: true });
  rmSync(w2.path, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
