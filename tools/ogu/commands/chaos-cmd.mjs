import { repoRoot } from '../util.mjs';
import { generateChaosPlan, runChaosPlan, listChaosPlans, injectFault } from './lib/chaos-engine.mjs';

/**
 * ogu chaos:plan [--feature <slug>]
 * Generate a chaos test plan for a feature.
 */
export async function chaosPlan() {
  const args = process.argv.slice(3);
  const featureIdx = args.indexOf('--feature');
  const featureSlug = featureIdx >= 0 ? args[featureIdx + 1] : null;
  const root = repoRoot();

  const plan = generateChaosPlan(root, featureSlug);
  console.log(`\n  Chaos plan created: ${plan.planId}`);
  console.log(`  Scenarios: ${plan.scenarios.length}`);
  for (const s of plan.scenarios) {
    console.log(`    - ${s.type}: ${s.description || s.type}`);
  }
  console.log('');
  return 0;
}

/**
 * ogu chaos:run <planId>
 * Execute a chaos test plan.
 */
export async function chaosRun() {
  const planId = process.argv[3];
  if (!planId) {
    console.error('Usage: ogu chaos:run <planId>');
    return 1;
  }
  const root = repoRoot();

  console.log(`\n  Running chaos plan: ${planId}\n`);
  const results = runChaosPlan(root, planId);

  if (!results || !results.results) {
    console.error('  Plan not found or empty');
    return 1;
  }

  let passed = 0;
  let failed = 0;
  for (const r of results.results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const icon = r.passed ? '✓' : '✗';
    console.log(`  ${icon} ${r.type.padEnd(28)} ${status}${r.error ? ` — ${r.error}` : ''}`);
    if (r.passed) passed++;
    else failed++;
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return failed > 0 ? 1 : 0;
}

/**
 * ogu chaos:list
 * List existing chaos plans.
 */
export async function chaosList() {
  const root = repoRoot();
  const result = listChaosPlans(root);
  const plans = result?.plans || [];

  if (plans.length === 0) {
    console.log('\n  No chaos plans found. Run: ogu chaos:plan\n');
    return 0;
  }

  console.log(`\n  Chaos Plans (${plans.length}):\n`);
  for (const planId of plans) {
    console.log(`  ${planId}`);
  }
  console.log('');
  return 0;
}

/**
 * ogu chaos:inject <type> [--feature <slug>]
 * Inject a single fault for testing.
 */
export async function chaosInject() {
  const args = process.argv.slice(3);
  const type = args[0];
  if (!type) {
    console.error('Usage: ogu chaos:inject <type> [--feature <slug>]');
    console.error('Types: agent_failure, budget_exhaustion, policy_conflict, blast_radius_violation, model_unavailable, concurrent_overload, secret_leak_attempt, session_expiry');
    return 1;
  }

  const featureIdx = args.indexOf('--feature');
  const featureSlug = featureIdx >= 0 ? args[featureIdx + 1] : undefined;
  const root = repoRoot();

  const result = injectFault(root, type, {}, featureSlug);
  if (result.injected) {
    console.log(`\n  Fault injected: ${type}`);
    console.log(`  Detected: ${result.detected ? 'YES' : 'NO'}`);
    console.log(`  Cleaned up: ${result.cleanedUp ? 'YES' : 'NO'}`);
  } else {
    console.log(`\n  Injection failed: ${result.error || 'unknown error'}`);
  }
  console.log('');
  return result.injected ? 0 : 1;
}
