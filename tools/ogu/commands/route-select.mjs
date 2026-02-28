import { repoRoot } from '../util.mjs';
import { routeSelect } from './lib/model-router.mjs';

/**
 * ogu route:select — Select optimal model for a task.
 *
 * Usage:
 *   ogu route:select --capability code_generation [--tier standard] [--min-tier fast] [--budget-aware] [--json]
 */
export async function routeSelectCmd() {
  const args = process.argv.slice(3);
  let capability = null, tier = null, minTier = null, budgetAware = false, jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--capability' && args[i + 1]) capability = args[++i];
    else if (args[i] === '--tier' && args[i + 1]) tier = args[++i];
    else if (args[i] === '--min-tier' && args[i + 1]) minTier = args[++i];
    else if (args[i] === '--budget-aware') budgetAware = true;
    else if (args[i] === '--json') jsonOutput = true;
  }

  if (!capability) {
    console.error('Usage: ogu route:select --capability <name> [--tier <tier>] [--min-tier <tier>] [--budget-aware] [--json]');
    return 1;
  }

  try {
    const route = routeSelect({
      root: repoRoot(),
      capability,
      tier,
      minTier,
      budgetAware,
    });

    if (jsonOutput) {
      console.log(JSON.stringify(route, null, 2));
    } else {
      console.log(`Provider: ${route.provider}`);
      console.log(`Model: ${route.model}`);
      console.log(`Tier: ${route.tier}`);
      console.log(`Cost: $${route.costPer1kInput}/1k input, $${route.costPer1kOutput}/1k output`);
      if (route.budgetConstrained) console.log(`⚠ Budget-constrained selection`);
      console.log(`Reason: ${route.reason}`);
    }
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}
