/**
 * AoaS Stripe Integration — stub implementation.
 * In production, replace with actual Stripe SDK calls.
 * STRIPE_SECRET_KEY env var controls real vs mock mode.
 */
import { readTable, writeTable, randomUUID } from '../auth/db.mjs';
import { getUserById, updateUserPlan } from '../auth/user-store.mjs';

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock');

function mockCheckoutUrl(userId, plan) {
  return `http://localhost:4200/mock-checkout?user=${userId}&plan=${plan}&session=${randomUUID()}`;
}

function mockPortalUrl(userId) {
  return `http://localhost:4200/mock-portal?user=${userId}`;
}

/**
 * Get or create a Stripe customer for a user.
 * Returns: customerId string
 */
export async function createOrGetCustomer(user) {
  const orgs = readTable('orgs');
  const org = orgs.find(o => o.id === user.org_id);
  if (org?.stripe_customer_id) return org.stripe_customer_id;

  const customerId = MOCK_MODE ? `cus_mock_${randomUUID().slice(0, 8)}` : await _createStripeCustomer(user);

  if (org) {
    const idx = orgs.indexOf(org);
    orgs[idx].stripe_customer_id = customerId;
    writeTable('orgs', orgs);
  }
  return customerId;
}

async function _createStripeCustomer(user) {
  // Real Stripe SDK call — only reached when STRIPE_SECRET_KEY is set
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customer = await stripe.customers.create({ email: user.email, name: user.name });
    return customer.id;
  } catch {
    return `cus_fallback_${randomUUID().slice(0, 8)}`;
  }
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 * Returns { url }
 */
export async function createCheckoutSession(userId, plan) {
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');

  if (MOCK_MODE) {
    return { url: mockCheckoutUrl(userId, plan), sessionId: `cs_mock_${randomUUID().slice(0, 8)}` };
  }

  const customerId = await createOrGetCustomer(user);
  const priceId = plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ENTERPRISE_PRICE_ID;
  if (!priceId) throw new Error(`No price ID configured for plan: ${plan}`);

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:4200'}/billing?success=true`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:4200'}/billing?canceled=true`,
    });
    return { url: session.url, sessionId: session.id };
  } catch (e) {
    return { url: mockCheckoutUrl(userId, plan), sessionId: `cs_error_${randomUUID().slice(0, 8)}` };
  }
}

/**
 * Create a Stripe Customer Portal session.
 * Returns { url }
 */
export async function createPortalSession(userId) {
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');

  if (MOCK_MODE) {
    return { url: mockPortalUrl(userId) };
  }

  const customerId = await createOrGetCustomer(user);
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL || 'http://localhost:4200'}/billing`,
    });
    return { url: session.url };
  } catch {
    return { url: mockPortalUrl(userId) };
  }
}

/**
 * Handle checkout.session.completed webhook.
 * Activates user subscription.
 */
export async function handleCheckoutCompleted(session) {
  const { plan } = session.metadata || {};
  if (!plan) return;
  const users = readTable('users');
  const user = users.find(u => {
    const orgs = readTable('orgs');
    const org = orgs.find(o => o.stripe_customer_id === session.customer);
    return org && u.org_id === org.id;
  });
  if (user) {
    updateUserPlan(user.id, plan);
  }
}
