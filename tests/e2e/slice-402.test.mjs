/**
 * Slice 402 — Stripe Integration (mock mode)
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

console.log('\n\x1b[1mSlice 402 — Stripe Integration (mock mode)\x1b[0m\n');

// Use mock mode (no real Stripe key)
delete process.env.STRIPE_SECRET_KEY;

const { createCheckoutSession, createPortalSession, createOrGetCustomer } =
  await import('../../tools/studio/server/billing/stripe.mjs');
const { createUser } = await import('../../tools/studio/server/auth/user-store.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-402-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

await assertAsync('createCheckoutSession returns url in mock mode', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe1@test.com', password: 'pw', name: 'S1' });
  const result = await createCheckoutSession(user.id, 'pro');
  if (!result.url) throw new Error('no url');
  if (!result.sessionId) throw new Error('no sessionId');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('createCheckoutSession url is string', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe2@test.com', password: 'pw', name: 'S2' });
  const result = await createCheckoutSession(user.id, 'enterprise');
  if (typeof result.url !== 'string') throw new Error('url should be string');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('createCheckoutSession throws for unknown user', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { await createCheckoutSession('nonexistent-user', 'pro'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for unknown user');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('createPortalSession returns url in mock mode', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe3@test.com', password: 'pw', name: 'S3' });
  const result = await createPortalSession(user.id);
  if (!result.url) throw new Error('no url');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('createOrGetCustomer creates customerId', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe4@test.com', password: 'pw', name: 'S4' });
  const customerId = await createOrGetCustomer(user);
  if (!customerId) throw new Error('no customerId');
  if (!customerId.startsWith('cus_')) throw new Error(`expected cus_ prefix, got ${customerId}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('createOrGetCustomer is idempotent', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe5@test.com', password: 'pw', name: 'S5' });
  const id1 = await createOrGetCustomer(user);
  const id2 = await createOrGetCustomer(user);
  if (id1 !== id2) throw new Error('should return same customerId');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('mock checkout sessionId starts with cs_mock_', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe6@test.com', password: 'pw', name: 'S6' });
  const result = await createCheckoutSession(user.id, 'pro');
  if (!result.sessionId.startsWith('cs_mock_')) throw new Error(`expected cs_mock_, got ${result.sessionId}`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('portal url contains user id', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe7@test.com', password: 'pw', name: 'S7' });
  const result = await createPortalSession(user.id);
  if (!result.url.includes(user.id)) throw new Error('url should include userId');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('checkout url includes plan name', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'stripe8@test.com', password: 'pw', name: 'S8' });
  const result = await createCheckoutSession(user.id, 'pro');
  if (!result.url.includes('pro')) throw new Error('url should include plan name');
  rmSync(dir, { recursive: true, force: true });
});

assert('mock mode when no STRIPE_SECRET_KEY', () => {
  const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock');
  if (!isMock) throw new Error('should be in mock mode');
});

await assertAsync('createPortalSession throws for unknown user', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { await createPortalSession('nonexistent'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw');
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('different users get different checkout URLs', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const u1 = createUser({ email: 'stripe9@test.com', password: 'pw', name: 'S9' });
  const u2 = createUser({ email: 'stripe10@test.com', password: 'pw', name: 'S10' });
  const r1 = await createCheckoutSession(u1.id, 'pro');
  const r2 = await createCheckoutSession(u2.id, 'pro');
  if (r1.url === r2.url) throw new Error('URLs should be different for different users');
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
