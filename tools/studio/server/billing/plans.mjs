/**
 * AoaS Subscription Plans
 */
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    compilationsPerMonth: 3,
    storageGb: 1,
    agentsMax: 5,
    priceUsd: 0,
    features: ['3 compilations/month', '1 GB storage', 'Up to 5 agents', 'Community support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    compilationsPerMonth: 50,
    storageGb: 10,
    agentsMax: 50,
    priceUsd: 49,
    features: ['50 compilations/month', '10 GB storage', 'Up to 50 agents', 'Priority support'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    compilationsPerMonth: -1, // unlimited
    storageGb: 100,
    agentsMax: -1, // unlimited
    priceUsd: 199,
    features: ['Unlimited compilations', '100 GB storage', 'Unlimited agents', 'Dedicated support', 'SSO'],
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function isUnlimited(limit) {
  return limit === -1;
}

export function planNames() {
  return Object.keys(PLANS);
}
