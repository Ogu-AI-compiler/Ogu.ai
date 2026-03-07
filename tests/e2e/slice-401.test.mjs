/**
 * Slice 401 — Subscription Plans + Quota
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

console.log('\n\x1b[1mSlice 401 — Subscription Plans + Quota\x1b[0m\n');

const { PLANS, getPlan, isUnlimited, planNames } =
  await import('../../tools/studio/server/billing/plans.mjs');
const { checkQuota, incrementUsage, getUsageSummary } =
  await import('../../tools/studio/server/billing/quota.mjs');
const { createUser, updateUserPlan } = await import('../../tools/studio/server/auth/user-store.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-401-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Plans tests ──

assert('PLANS has free, pro, enterprise', () => {
  if (!PLANS.free) throw new Error('missing free');
  if (!PLANS.pro) throw new Error('missing pro');
  if (!PLANS.enterprise) throw new Error('missing enterprise');
});

assert('free plan has 3 compilations, 0 price', () => {
  if (PLANS.free.compilationsPerMonth !== 3) throw new Error(`expected 3, got ${PLANS.free.compilationsPerMonth}`);
  if (PLANS.free.priceUsd !== 0) throw new Error('should be free');
});

assert('pro plan has 50 compilations, $49', () => {
  if (PLANS.pro.compilationsPerMonth !== 50) throw new Error(`expected 50, got ${PLANS.pro.compilationsPerMonth}`);
  if (PLANS.pro.priceUsd !== 49) throw new Error(`expected 49, got ${PLANS.pro.priceUsd}`);
});

assert('enterprise plan has unlimited compilations (-1)', () => {
  if (PLANS.enterprise.compilationsPerMonth !== -1) throw new Error('should be -1 (unlimited)');
});

assert('getPlan returns correct plan', () => {
  const p = getPlan('pro');
  if (p.id !== 'pro') throw new Error('wrong plan');
});

assert('getPlan returns free for unknown plan', () => {
  const p = getPlan('unknown-plan');
  if (p.id !== 'free') throw new Error('should return free for unknown');
});

assert('isUnlimited returns true for -1', () => {
  if (!isUnlimited(-1)) throw new Error('should be unlimited');
});

assert('isUnlimited returns false for positive limit', () => {
  if (isUnlimited(50)) throw new Error('should not be unlimited');
});

assert('planNames returns all 3 plan names', () => {
  const names = planNames();
  if (names.length !== 3) throw new Error(`expected 3, got ${names.length}`);
  if (!names.includes('free')) throw new Error('missing free');
});

// ── Quota tests ──

assert('checkQuota allows compile for new free user', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'quota1@test.com', password: 'pw', name: 'Q1' });
  const result = checkQuota(user.id, 'compile');
  if (!result.allowed) throw new Error('should allow first compile');
  if (result.remaining !== 3) throw new Error(`expected 3, got ${result.remaining}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('incrementUsage reduces remaining quota', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'quota2@test.com', password: 'pw', name: 'Q2' });
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'compile');
  const result = checkQuota(user.id, 'compile');
  if (result.remaining !== 1) throw new Error(`expected 1, got ${result.remaining}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('checkQuota blocks when limit reached', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'quota3@test.com', password: 'pw', name: 'Q3' });
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'compile');
  const result = checkQuota(user.id, 'compile');
  if (result.allowed) throw new Error('should be blocked at limit');
  if (result.remaining !== 0) throw new Error('remaining should be 0');
  rmSync(dir, { recursive: true, force: true });
});

assert('getUsageSummary returns current month usage', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'quota4@test.com', password: 'pw', name: 'Q4' });
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'compile');
  const summary = getUsageSummary(user.id);
  if (summary.compilations !== 2) throw new Error(`expected 2, got ${summary.compilations}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('enterprise plan has unlimited quota', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'quota5@test.com', password: 'pw', name: 'Q5' });
  updateUserPlan(user.id, 'enterprise');
  // Add many compiles
  for (let i = 0; i < 10; i++) incrementUsage(user.id, 'compile');
  const result = checkQuota(user.id, 'compile');
  if (!result.allowed) throw new Error('enterprise should have unlimited quota');
  if (result.limit !== -1) throw new Error('limit should be -1 for enterprise');
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
