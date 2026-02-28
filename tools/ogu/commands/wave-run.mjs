import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { executeDAG } from './lib/agent-runtime.mjs';

/**
 * ogu wave:run --feature <slug> [--dry-run] [--json]
 *
 * Execute a feature's Plan.json as a DAG of waves.
 * Each wave runs tasks in parallel, waves execute sequentially.
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { feature: null, dryRun: false, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--dry-run') result.dryRun = true;
    else if (args[i] === '--json') result.json = true;
  }
  return result;
}

export async function waveRun() {
  const args = parseArgs();

  if (!args.feature) {
    console.error('Usage: ogu wave:run --feature <slug> [--dry-run] [--json]');
    return 1;
  }

  const root = repoRoot();
  const planPath = join(root, `docs/vault/features/${args.feature}/Plan.json`);

  if (!existsSync(planPath)) {
    console.error(`Plan.json not found for feature "${args.feature}"`);
    return 1;
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const tasks = plan.tasks || [];

  if (tasks.length === 0) {
    console.error('Plan.json has no tasks.');
    return 1;
  }

  const result = await executeDAG({
    featureSlug: args.feature,
    tasks,
    dryRun: args.dryRun,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`\nWave Execution: "${args.feature}" ${args.dryRun ? '(dry-run)' : ''}`);
  console.log(`  Tasks: ${tasks.length} | Waves: ${result.waves.length}\n`);

  for (let i = 0; i < result.waves.length; i++) {
    const waveResult = result.waveResults[i];
    console.log(`  Wave ${i}: ${result.waves[i].join(', ')}`);
    if (waveResult) {
      const completedIds = waveResult.completed.map(c => c.taskId);
      for (const c of waveResult.completed) {
        const alloc = result.allocations.find(a => a.taskId === c.taskId);
        console.log(`    ✓ ${c.taskId} → ${alloc?.roleId || '?'}`);
      }
      for (const f of waveResult.failed) {
        console.log(`    ✗ ${f.taskId}: ${f.error}`);
      }
    }
  }

  console.log(`\n  Done: ${result.tasksCompleted} completed, ${result.tasksFailed} failed\n`);
  return result.tasksFailed > 0 ? 1 : 0;
}
