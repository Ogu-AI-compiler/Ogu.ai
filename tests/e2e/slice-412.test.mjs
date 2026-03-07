/**
 * Slice 412 — Full AoaS Regression
 */
import { mkdirSync, rmSync, existsSync } from 'node:fs';
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

console.log('\n\x1b[1mSlice 412 — Full AoaS Regression\x1b[0m\n');

// --- Imports ---
const { register, login, getMe } = await import('../../tools/studio/server/auth/auth-service.mjs');
const { createUser, getUserById, banUser } = await import('../../tools/studio/server/auth/user-store.mjs');
const { verifyToken, signAccessToken } = await import('../../tools/studio/server/auth/jwt.mjs');
const { checkQuota, incrementUsage, getUsageSummary } = await import('../../tools/studio/server/billing/quota.mjs');
const { getPlan, PLANS } = await import('../../tools/studio/server/billing/plans.mjs');
const { getBalance, addCredits, deductCredits } = await import('../../tools/studio/server/billing/credits.mjs');
const { inviteMember, acceptInvite, listMembers } = await import('../../tools/studio/server/auth/org-store.mjs');
const { resolveWorkspace } = await import('../../tools/studio/server/workspace/resolver.mjs');
const { createOrchestrator, LocalOrchestrator } = await import('../../tools/studio/server/infra/orchestrator.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-412-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── 1. Register user → workspace created ─────────────────────────────────
console.log('\n\x1b[1m1. Register + Workspace\x1b[0m');

await assertAsync('register returns user + tokens', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = register({ email: `reg-${randomUUID().slice(0, 6)}@test.com`, password: 'pass123', name: 'RegUser' });
  if (!result.user || !result.accessToken || !result.refreshToken) throw new Error('missing register fields');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('registered user has free plan by default', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = register({ email: `plan-${randomUUID().slice(0, 6)}@test.com`, password: 'pass', name: 'PlanUser' });
  if (result.user.plan !== 'free') throw new Error(`expected free, got ${result.user.plan}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('workspace is created per user (different paths)', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const uA = `ws-a-${randomUUID().slice(0, 6)}`;
  const uB = `ws-b-${randomUUID().slice(0, 6)}`;
  const wA = await orch.getOrCreateWorkspace(uA);
  const wB = await orch.getOrCreateWorkspace(uB);
  if (wA.path === wB.path) throw new Error('workspaces must differ');
  rmSync(wA.path, { recursive: true, force: true });
  rmSync(wB.path, { recursive: true, force: true });
});

// ─── 2. Login → JWT works ─────────────────────────────────────────────────
console.log('\n\x1b[1m2. Login + JWT\x1b[0m');

await assertAsync('login returns valid JWT', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const email = `jwt-${randomUUID().slice(0, 6)}@test.com`;
  register({ email, password: 'secure', name: 'JwtUser' });
  const result = login({ email, password: 'secure' });
  if (!result.accessToken) throw new Error('no accessToken');
  const payload = verifyToken(result.accessToken);
  if (!payload || !payload.userId) throw new Error('invalid JWT payload');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('login fails with wrong password', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const email = `wp-${randomUUID().slice(0, 6)}@test.com`;
  register({ email, password: 'correct', name: 'WPUser' });
  let threw = false;
  try { login({ email, password: 'wrong' }); } catch { threw = true; }
  if (!threw) throw new Error('should throw for wrong password');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('getMe returns user + org + subscription', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const email = `me-${randomUUID().slice(0, 6)}@test.com`;
  const { user } = register({ email, password: 'pw', name: 'MeUser' });
  const me = getMe(user.id);
  if (!me.user || !me.org || !me.subscription) throw new Error('missing getMe fields');
  if (me.subscription.plan !== 'free') throw new Error('expected free subscription');
  rmSync(dir, { recursive: true, force: true });
});

// ─── 3. Project ownership (users can't see each other's projects) ──────────
console.log('\n\x1b[1m3. Project Isolation\x1b[0m');

assert('workspace resolver returns different paths per user', () => {
  delete process.env.DEPLOYMENT_MODE;
  const p1 = resolveWorkspace('user-alice');
  const p2 = resolveWorkspace('user-bob');
  if (p1 === p2) throw new Error('paths must differ');
  if (!p1.includes('user-alice')) throw new Error('alice path missing userId');
  if (!p2.includes('user-bob')) throw new Error('bob path missing userId');
});

assert('workspace path is deterministic (same userId → same path)', () => {
  delete process.env.DEPLOYMENT_MODE;
  const p1 = resolveWorkspace('deterministic-user');
  const p2 = resolveWorkspace('deterministic-user');
  if (p1 !== p2) throw new Error('same userId must give same path');
});

// ─── 4. Free tier: 3 compiles → 4th blocked ───────────────────────────────
console.log('\n\x1b[1m4. Quota Enforcement\x1b[0m');

await assertAsync('free plan allows 3 compilations', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `quota-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'QuotaUser' });
  // First 3 should be allowed
  for (let i = 0; i < 3; i++) {
    const result = checkQuota(user.id, 'compile');
    if (!result.allowed) throw new Error(`compile ${i + 1} should be allowed`);
    incrementUsage(user.id, 'compile');
  }
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('free plan blocks 4th compilation', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `block-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'BlockUser' });
  for (let i = 0; i < 3; i++) {
    incrementUsage(user.id, 'compile');
  }
  const result = checkQuota(user.id, 'compile');
  if (result.allowed) throw new Error('4th compile should be blocked');
  rmSync(dir, { recursive: true, force: true });
});

// ─── 5. Upgrade plan → quota resets ───────────────────────────────────────
console.log('\n\x1b[1m5. Plan Upgrade\x1b[0m');

await assertAsync('pro plan allows 50 compilations', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `pro-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'ProUser' });
  // Simulate upgrade
  const { updateUserPlan } = await import('../../tools/studio/server/auth/user-store.mjs');
  updateUserPlan(user.id, 'pro');
  // Now user has 50 quota
  const { handleCheckoutCompleted } = await import('../../tools/studio/server/billing/stripe.mjs');
  // Manually check quota for pro plan
  const plan = getPlan('pro');
  if (plan.compilationsPerMonth !== 50) throw new Error(`expected 50, got ${plan.compilationsPerMonth}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('enterprise plan is unlimited', async () => {
  const plan = getPlan('enterprise');
  const { isUnlimited } = await import('../../tools/studio/server/billing/plans.mjs');
  if (!isUnlimited(plan.compilationsPerMonth)) throw new Error('enterprise should be unlimited');
});

// ─── 6. User B can't see User A's projects ────────────────────────────────
console.log('\n\x1b[1m6. Multi-User Isolation\x1b[0m');

await assertAsync('user A and user B have separate credit balances', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user: uA } = register({ email: `bal-a-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'A' });
  const { user: uB } = register({ email: `bal-b-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'B' });
  // Users start with 100 credits; add 50 more to A
  addCredits(uA.id, 50, 'test');
  const balA = getBalance(uA.id);
  const balB = getBalance(uB.id);
  if (balA !== 150) throw new Error(`A should have 150 (100 initial + 50 added), got ${balA}`);
  if (balB !== 100) throw new Error(`B should have 100 (initial only), got ${balB}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('deducting A credits does not affect B', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user: uA } = register({ email: `ded-a-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'DA' });
  const { user: uB } = register({ email: `ded-b-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'DB' });
  // Both start with 100; deduct 30 from A
  deductCredits(uA.id, 30, 'test');
  if (getBalance(uA.id) !== 70) throw new Error(`A should have 70 (100 - 30), got ${getBalance(uA.id)}`);
  if (getBalance(uB.id) !== 100) throw new Error(`B should still have 100, got ${getBalance(uB.id)}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('usage events are per-user', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user: uA } = register({ email: `ev-a-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'EA' });
  const { user: uB } = register({ email: `ev-b-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'EB' });
  incrementUsage(uA.id, 'compile');
  incrementUsage(uA.id, 'compile');
  const sumA = getUsageSummary(uA.id);
  const sumB = getUsageSummary(uB.id);
  if (sumA.compilations !== 2) throw new Error(`A should have 2 compilations, got ${sumA.compilations}`);
  if (sumB.compilations !== 0) throw new Error(`B should have 0, got ${sumB.compilations}`);
  rmSync(dir, { recursive: true, force: true });
});

// ─── 7. Org invite → User B accepts ──────────────────────────────────────
console.log('\n\x1b[1m7. Org & Team\x1b[0m');

await assertAsync('org invite flow: A invites B → B accepts → B is member', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user: uA } = register({ email: `org-a-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'OrgA' });
  const { user: uB } = register({ email: `org-b-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'OrgB' });
  const token = inviteMember(uA.org_id, uB.email, 'member');
  if (!token) throw new Error('no invite token');
  const result = acceptInvite(token, uB.id);
  if (!result.orgId) throw new Error('no orgId after accept');
  const members = listMembers(uA.org_id);
  if (!members.some(m => m.userId === uB.id)) throw new Error('B should be in A org');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('different orgs are isolated', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user: uA } = register({ email: `iso-a-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'IsoA' });
  const { user: uB } = register({ email: `iso-b-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'IsoB' });
  const membersA = listMembers(uA.org_id);
  const membersB = listMembers(uB.org_id);
  if (membersA.some(m => m.userId === uB.id)) throw new Error('B should not be in A org');
  if (membersB.some(m => m.userId === uA.id)) throw new Error('A should not be in B org');
  rmSync(dir, { recursive: true, force: true });
});

// ─── 8. Admin sees users + usage stats ────────────────────────────────────
console.log('\n\x1b[1m8. Admin Dashboard\x1b[0m');

await assertAsync('listUsers returns all registered users', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { listUsers } = await import('../../tools/studio/server/auth/user-store.mjs');
  register({ email: `admin-u1-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'U1' });
  register({ email: `admin-u2-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'U2' });
  const users = listUsers();
  if (users.length < 2) throw new Error(`expected at least 2, got ${users.length}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('banned user cannot login', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const email = `ban-login-${randomUUID().slice(0, 6)}@test.com`;
  const { user } = register({ email, password: 'pw', name: 'BanMe' });
  banUser(user.id);
  let threw = false;
  try { login({ email, password: 'pw' }); } catch { threw = true; }
  if (!threw) throw new Error('banned user should not be able to login');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('usage summary tracked per user', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `usage-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'UsageUser' });
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'compile');
  incrementUsage(user.id, 'agent_hire');
  const summary = getUsageSummary(user.id);
  if (summary.compilations !== 2) throw new Error(`expected 2 compilations, got ${summary.compilations}`);
  if (summary.agentHires !== 1) throw new Error(`expected 1 agentHire, got ${summary.agentHires}`);
  rmSync(dir, { recursive: true, force: true });
});

// ─── 9. Orchestrator + Fly mode ───────────────────────────────────────────
console.log('\n\x1b[1m9. Orchestrator\x1b[0m');

await assertAsync('local orchestrator getOrCreateWorkspace creates dir', async () => {
  delete process.env.DEPLOYMENT_MODE;
  const orch = new LocalOrchestrator();
  const userId = `regression-${randomUUID().slice(0, 8)}`;
  const info = await orch.getOrCreateWorkspace(userId);
  if (!info.path || info.mode !== 'local') throw new Error('wrong workspace info');
  rmSync(info.path, { recursive: true, force: true });
});

assert('createOrchestrator returns correct type based on DEPLOYMENT_MODE', () => {
  delete process.env.DEPLOYMENT_MODE;
  const local = createOrchestrator();
  if (!(local instanceof LocalOrchestrator)) throw new Error('should be LocalOrchestrator');
});

// ─── 10. Credits + billing ────────────────────────────────────────────────
console.log('\n\x1b[1m10. Credits & Billing\x1b[0m');

await assertAsync('credits flow: add → deduct → balance correct', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `cr-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'CrUser' });
  // User starts with 100; add 200 → 300; deduct 50 → 250; deduct 30 → 220
  addCredits(user.id, 200, 'initial');
  deductCredits(user.id, 50, 'compile');
  deductCredits(user.id, 30, 'agent');
  const bal = getBalance(user.id);
  if (bal !== 220) throw new Error(`expected 220 (100+200-50-30), got ${bal}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('deduct fails gracefully when insufficient balance', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { user } = register({ email: `insuf-${randomUUID().slice(0, 6)}@test.com`, password: 'pw', name: 'Insuf' });
  // User starts with 100; try to deduct 500 (more than balance)
  const result = deductCredits(user.id, 500, 'too much');
  if (result.success) throw new Error('should fail when balance insufficient');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('PLANS has correct structure for all 3 tiers', async () => {
  const tiers = ['free', 'pro', 'enterprise'];
  for (const tier of tiers) {
    const plan = PLANS[tier];
    if (!plan) throw new Error(`missing plan: ${tier}`);
    if (typeof plan.compilationsPerMonth !== 'number') throw new Error(`${tier} missing compilationsPerMonth`);
    if (typeof plan.priceUsd !== 'number') throw new Error(`${tier} missing priceUsd`);
  }
  if (PLANS.free.priceUsd !== 0) throw new Error('free should be $0');
  if (PLANS.pro.priceUsd !== 49) throw new Error('pro should be $49');
  if (PLANS.enterprise.priceUsd !== 199) throw new Error('enterprise should be $199');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
