/**
 * Slice 366 — Full Integration Smoke Test
 *
 * Exercises the full chain across all major subsystems:
 *   1. Kadima: initKadimaFromOrgSpec → allocatePlan → check assignments
 *   2. Semantic locks: acquire → predictConflicts → release
 *   3. Functional hash: compute → detectDrift
 *   4. MicroVM: create → execute → destroy
 *   5. Secret vault: issue → retrieve → revoke
 *   6. Scheduler: create → enqueue → dequeue
 *   7. Envelope: seal → verifySeal
 *   8. Governance: checkGovernance with policies
 *   9. Worker: create → execute noop → drain
 *  10. Circuit breaker: trip → probe → reset
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-e2e-366-${randomUUID().slice(0, 8)}`);
  for (const d of [
    '.ogu/state', '.ogu/audit', '.ogu/agents', '.ogu/budget', '.ogu/locks',
    '.ogu/governance', '.ogu/secrets', '.ogu/vms', '.ogu/chaos',
    '.ogu/knowledge', '.ogu/overrides', '.ogu/performance',
    'src',
  ]) {
    mkdirSync(join(root, d), { recursive: true });
  }
  writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify({
    defaults: { model: 'claude-sonnet-4-20250514' },
    roles: [
      { roleId: 'cto', enabled: true, capabilities: ['override', 'governance'], maxConcurrent: 1 },
      { roleId: 'backend-dev', enabled: true, capabilities: ['code-gen', 'implementation'], maxConcurrent: 3 },
      { roleId: 'qa', enabled: true, capabilities: ['testing', 'qa'], maxConcurrent: 2 },
      { roleId: 'devops', enabled: true, capabilities: ['deployment'], maxConcurrent: 1 },
    ],
    teams: [{ teamId: 'core', roles: ['backend-dev', 'qa'] }],
  }), 'utf8');
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({
    policies: [
      { id: 'P1', name: 'Block .env', enabled: true, trigger: 'path_match', patterns: ['.env*'], action: 'deny' },
    ],
  }), 'utf8');
  writeFileSync(join(root, '.ogu/model-config.json'), JSON.stringify({
    tiers: { fast: { models: ['haiku'] }, standard: { models: ['sonnet'] }, premium: { models: ['opus'] } },
  }), 'utf8');
  writeFileSync(join(root, '.ogu/STATE.json'), '{}', 'utf8');
  writeFileSync(join(root, 'src/app.ts'), 'export const app = true;', 'utf8');
  return root;
}

console.log("\n\x1b[1mSlice 366 — Full Integration Smoke Test\x1b[0m\n");

const root = makeTmpRoot();

// ═══ 1. Kadima ═══
console.log("\x1b[36m  Part 1: Kadima Engine\x1b[0m");
const kadima = await import(join(process.cwd(), 'tools/ogu/commands/lib/kadima-engine.mjs'));

assert('initKadimaFromOrgSpec loads all roles', () => {
  const r = kadima.initKadimaFromOrgSpec(root);
  if (!r.engine || r.roles.length < 4) throw new Error('roles missing');
});

assert('allocatePlan assigns tasks', () => {
  const allocs = kadima.allocatePlan(
    [{ id: 'T1', phase: 'build' }, { id: 'T2', phase: 'verify' }],
    { root, featureSlug: 'e2e' },
  );
  if (allocs.length !== 2 || !allocs[0].roleId) throw new Error('allocation failed');
});

// ═══ 2. Semantic Locks ═══
console.log("\x1b[36m  Part 2: Semantic Locks\x1b[0m");
const sl = await import(join(process.cwd(), 'tools/ogu/commands/lib/semantic-lock.mjs'));

let lockId;
assert('acquire → predict → release', () => {
  const res = sl.acquireSemanticLock(root, { files: ['src/app.ts'], agentId: 'a1', taskId: 'T1', featureSlug: 'e2e' });
  if (!res.acquired) throw new Error('lock failed');
  lockId = res.lockId;
  const pred = sl.predictConflicts(root, { files: ['src/app.ts'], currentLocks: sl.getActiveLocks(root) });
  if (!Array.isArray(pred) || pred.length === 0) throw new Error('no conflicts');
  const rel = sl.releaseSemanticLock(root, lockId);
  if (!rel.released) throw new Error('release failed');
});

// ═══ 3. Functional Hash ═══
console.log("\x1b[36m  Part 3: Functional Hash\x1b[0m");
const fh = await import(join(process.cwd(), 'tools/ogu/commands/lib/functional-hash.mjs'));

assert('computeFunctionalHash + detectDrift', () => {
  const h1 = fh.computeFunctionalHash('function a() { return 1; }', 'js');
  const h2 = fh.computeFunctionalHash('function b() { return 2; }', 'js');
  const drift = fh.detectDrift(h1, h2);
  if (!drift || !drift.severity) throw new Error('drift detection failed');
});

// ═══ 4. MicroVM ═══
console.log("\x1b[36m  Part 4: MicroVM\x1b[0m");
const mvm = await import(join(process.cwd(), 'tools/ogu/commands/lib/microvm.mjs'));

assert('createVM → executeInVM → destroyVM', () => {
  const v = mvm.createVM(root, { agentId: 'a1', taskId: 'T1', featureSlug: 'e2e' });
  if (!v.vmId) throw new Error('create failed');
  mvm.executeInVM(root, v.vmId, { command: 'echo', args: ['ok'] });
  mvm.destroyVM(root, v.vmId);
  if (mvm.listActiveVMs(root).some(x => x.vmId === v.vmId)) throw new Error('not destroyed');
});

// ═══ 5. Secret Vault ═══
console.log("\x1b[36m  Part 5: Secret Vault\x1b[0m");
const sv = await import(join(process.cwd(), 'tools/ogu/commands/lib/secret-vault.mjs'));

assert('issue → retrieve → revoke', () => {
  sv.issueSecret(root, { key: 'e2e-key', value: 'e2e-val', grantedTo: ['admin'] });
  if (sv.retrieveSecret(root, 'e2e-key', 'admin') !== 'e2e-val') throw new Error('wrong value');
  sv.revokeSecret(root, 'e2e-key', 'admin');
  if (sv.retrieveSecret(root, 'e2e-key', 'admin') !== null) throw new Error('not revoked');
});

// ═══ 6. Scheduler WFQ ═══
console.log("\x1b[36m  Part 6: Scheduler WFQ\x1b[0m");
const wfq = await import(join(process.cwd(), 'tools/ogu/commands/lib/scheduler-wfq.mjs'));

assert('enqueue → dequeue', () => {
  const s = wfq.createFormalScheduler();
  s.enqueue({ id: 'T1' }, { weight: 1, priority: 80, team: 'core' });
  s.enqueue({ id: 'T2' }, { weight: 1, priority: 50, team: 'core' });
  if (!s.dequeue()) throw new Error('dequeue null');
});

// ═══ 7. Envelope ═══
console.log("\x1b[36m  Part 7: Envelope Protocol\x1b[0m");
const ep = await import(join(process.cwd(), 'tools/ogu/commands/lib/envelope-protocol.mjs'));

assert('sealEnvelope → verifySeal', () => {
  const input = ep.createInputEnvelope({ taskId: 'T1', agentId: 'a1', feature: 'e2e', phase: 'build', context: {} });
  const sealed = ep.sealEnvelope(input);
  if (!ep.verifySeal(sealed).valid) throw new Error('seal failed');
});

// ═══ 8. Governance ═══
console.log("\x1b[36m  Part 8: Governance\x1b[0m");
const gov = await import(join(process.cwd(), 'tools/ogu/commands/lib/governance-engine.mjs'));

assert('DENY on .env', () => {
  const r = gov.checkGovernance(root, {
    featureSlug: 'e2e', taskName: 'T1', roleId: 'backend-dev',
    riskTier: 'medium', touches: ['.env.production'], phase: 'build',
  });
  if (r.decision !== 'DENY') throw new Error(`expected DENY, got ${r.decision}`);
});

assert('ALLOW on safe file', () => {
  const r = gov.checkGovernance(root, {
    featureSlug: 'e2e', taskName: 'T2', roleId: 'backend-dev',
    riskTier: 'low', touches: ['src/app.ts'], phase: 'build',
  });
  if (r.decision !== 'ALLOW') throw new Error(`expected ALLOW, got ${r.decision}`);
});

// ═══ 9. Worker ═══
console.log("\x1b[36m  Part 9: Worker\x1b[0m");
const wk = await import(join(process.cwd(), 'tools/runner/worker.mjs'));

assert('create → execute noop → drain', async () => {
  const workDir = join(tmpdir(), `ogu-e2e-w-${randomUUID().slice(0, 8)}`);
  mkdirSync(workDir, { recursive: true });
  const w = wk.createWorker({ workDir });
  const r = await w.execute({ taskId: 'T-e2e', command: 'noop', payload: {} });
  if (r.status !== 'success') throw new Error(`noop: ${r.status}`);
  await w.drain(2000);
  rmSync(workDir, { recursive: true, force: true });
});

// ═══ 10. Circuit Breaker ═══
console.log("\x1b[36m  Part 10: Circuit Breaker\x1b[0m");
const cb = await import(join(process.cwd(), 'tools/ogu/commands/lib/circuit-breaker.mjs'));

assert('trip → probe → reset', () => {
  cb.tripCircuitBreaker(root, 'FD-PROVIDER', 'e2e test');
  const p = cb.probeCircuitBreaker(root, 'FD-PROVIDER');
  if (p.state !== 'open') throw new Error(`expected open, got ${p.state}`);
  cb.resetBreaker(root, 'FD-PROVIDER');
  if (cb.probeCircuitBreaker(root, 'FD-PROVIDER').state !== 'closed') throw new Error('not reset');
});

// ═══ Cleanup ═══
rmSync(root, { recursive: true, force: true });

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
