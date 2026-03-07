/**
 * Slice 405 — Billing UI
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 405 — Billing UI\x1b[0m\n');

const cwd = process.cwd();

assert('Billing.tsx page exists', () => {
  if (!existsSync(join(cwd, 'tools/studio/src/pages/Billing.tsx'))) throw new Error('missing Billing.tsx');
});

assert('PlanCard.tsx component exists', () => {
  if (!existsSync(join(cwd, 'tools/studio/src/components/billing/PlanCard.tsx'))) throw new Error('missing PlanCard.tsx');
});

assert('UsageMeter.tsx component exists', () => {
  if (!existsSync(join(cwd, 'tools/studio/src/components/billing/UsageMeter.tsx'))) throw new Error('missing UsageMeter.tsx');
});

assert('CreditBalance.tsx component exists', () => {
  if (!existsSync(join(cwd, 'tools/studio/src/components/billing/CreditBalance.tsx'))) throw new Error('missing CreditBalance.tsx');
});

assert('Billing.tsx shows 3 plan cards', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/pages/Billing.tsx'), 'utf-8');
  const planCount = (src.match(/free|pro|enterprise/gi) || []).length;
  if (planCount < 3) throw new Error(`expected at least 3 plan refs, got ${planCount}`);
});

assert('Billing.tsx imports PlanCard', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/pages/Billing.tsx'), 'utf-8');
  if (!src.includes('PlanCard')) throw new Error('missing PlanCard import');
});

assert('Billing.tsx imports UsageMeter', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/pages/Billing.tsx'), 'utf-8');
  if (!src.includes('UsageMeter')) throw new Error('missing UsageMeter import');
});

assert('Billing.tsx imports CreditBalance', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/pages/Billing.tsx'), 'utf-8');
  if (!src.includes('CreditBalance')) throw new Error('missing CreditBalance import');
});

assert('PlanCard has upgrade button', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/components/billing/PlanCard.tsx'), 'utf-8');
  if (!src.includes('Upgrade') && !src.includes('onUpgrade')) throw new Error('missing upgrade button');
});

assert('UsageMeter shows progress bar', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/components/billing/UsageMeter.tsx'), 'utf-8');
  if (!src.includes('width') || !src.includes('height')) throw new Error('missing progress bar styles');
});

assert('CreditBalance shows low balance warning', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/components/billing/CreditBalance.tsx'), 'utf-8');
  if (!src.includes('isLow') && !src.includes('low')) throw new Error('missing low balance warning');
});

assert('MainArea.tsx includes Billing route', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/components/layout/MainArea.tsx'), 'utf-8');
  if (!src.includes('/billing')) throw new Error('missing /billing in MainArea');
});

assert('api.ts has getBillingSubscription', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/lib/api.ts'), 'utf-8');
  if (!src.includes('getBillingSubscription')) throw new Error('missing getBillingSubscription in api.ts');
});

assert('api.ts has createCheckoutSession', () => {
  const src = readFileSync(join(cwd, 'tools/studio/src/lib/api.ts'), 'utf-8');
  if (!src.includes('createCheckoutSession')) throw new Error('missing createCheckoutSession in api.ts');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
