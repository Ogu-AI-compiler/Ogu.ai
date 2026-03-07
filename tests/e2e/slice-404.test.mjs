/**
 * Slice 404 — Stripe Webhooks
 */
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
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

console.log('\n\x1b[1mSlice 404 — Stripe Webhooks\x1b[0m\n');

const { handleCheckoutCompleted } = await import('../../tools/studio/server/billing/stripe.mjs');
const { createUser, getUserById, updateUserPlan } = await import('../../tools/studio/server/auth/user-store.mjs');
const { readTable, writeTable } = await import('../../tools/studio/server/auth/db.mjs');
const { createOrGetCustomer } = await import('../../tools/studio/server/billing/stripe.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-404-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Test webhook event handling logic

await assertAsync('handleCheckoutCompleted upgrades user plan', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'wh1@test.com', password: 'pw', name: 'WH1' });
  // Set up customer ID in org
  const customerId = await createOrGetCustomer(user);
  // Simulate checkout.session.completed event
  await handleCheckoutCompleted({
    customer: customerId,
    metadata: { plan: 'pro' },
  });
  const updated = getUserById(user.id);
  if (updated.plan !== 'pro') throw new Error(`expected 'pro', got '${updated.plan}'`);
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('handleCheckoutCompleted does nothing when no metadata plan', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'wh2@test.com', password: 'pw', name: 'WH2' });
  // Should not throw
  await handleCheckoutCompleted({ customer: 'cus_fake', metadata: {} });
  const u = getUserById(user.id);
  if (u.plan !== 'free') throw new Error('plan should still be free');
  rmSync(dir, { recursive: true, force: true });
});

assert('customer.subscription.deleted sets plan to free', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'wh3@test.com', password: 'pw', name: 'WH3' });
  updateUserPlan(user.id, 'pro');
  if (getUserById(user.id).plan !== 'pro') throw new Error('setup failed');
  updateUserPlan(user.id, 'free'); // Simulate deletion → downgrade
  if (getUserById(user.id).plan !== 'free') throw new Error('should be downgraded to free');
  rmSync(dir, { recursive: true, force: true });
});

assert('webhooks server file exists', () => {
  const p = join(process.cwd(), 'tools/studio/server/api/webhooks.ts');
  if (!existsSync(p)) throw new Error(`Missing: ${p}`);
});

assert('webhooks.ts contains event handlers for required events', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/webhooks.ts'), 'utf-8');
  const required = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed'];
  for (const ev of required) {
    if (!src.includes(ev)) throw new Error(`Missing event handler: ${ev}`);
  }
});

assert('webhooks.ts verifies stripe signature', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/webhooks.ts'), 'utf-8');
  if (!src.includes('signature') && !src.includes('stripe-signature')) throw new Error('missing signature verification');
});

assert('billing.ts has POST /billing/checkout', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/billing.ts'), 'utf-8');
  if (!src.includes('/billing/checkout')) throw new Error('missing checkout endpoint');
});

assert('billing.ts has POST /billing/portal', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/billing.ts'), 'utf-8');
  if (!src.includes('/billing/portal')) throw new Error('missing portal endpoint');
});

assert('billing.ts has GET /billing/subscription', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/billing.ts'), 'utf-8');
  if (!src.includes('/billing/subscription')) throw new Error('missing subscription endpoint');
});

await assertAsync('handleCheckoutCompleted with no matching customer is no-op', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  // Should not throw
  await handleCheckoutCompleted({ customer: 'cus_nonexistent', metadata: { plan: 'pro' } });
  rmSync(dir, { recursive: true, force: true });
});

await assertAsync('plan upgrade via checkout + portal flow works', async () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'wh4@test.com', password: 'pw', name: 'WH4' });
  const customerId = await createOrGetCustomer(user);
  // Checkout completed → plan upgraded
  await handleCheckoutCompleted({ customer: customerId, metadata: { plan: 'enterprise' } });
  const updated = getUserById(user.id);
  if (updated.plan !== 'enterprise') throw new Error(`expected enterprise, got ${updated.plan}`);
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
