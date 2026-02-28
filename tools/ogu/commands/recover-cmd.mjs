import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { classifyError, getRetryStrategy, computeRewindPoint } from './lib/error-recovery.mjs';
import { buildDAG } from './lib/dag-builder.mjs';

/**
 * ogu recover:classify --code <OGU_CODE>
 * ogu recover:strategy --code <OGU_CODE>
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { code: null, feature: null, task: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code' && args[i + 1]) result.code = args[++i];
    else if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
  }
  return result;
}

export async function recoverClassify() {
  const args = parseArgs();
  if (!args.code) {
    console.error('Usage: ogu recover:classify --code <OGU_CODE>');
    return 1;
  }

  const classification = classifyError({ code: args.code, message: '' });
  console.log(`Error ${args.code}:`);
  console.log(`  Category: ${classification.category}`);
  console.log(`  Retryable: ${classification.retryable}`);
  console.log(`  Description: ${classification.description}`);
  return 0;
}

export async function recoverStrategy() {
  const args = parseArgs();
  if (!args.code) {
    console.error('Usage: ogu recover:strategy --code <OGU_CODE>');
    return 1;
  }

  const classification = classifyError({ code: args.code, message: '' });
  const strategy = getRetryStrategy(classification.category);

  console.log(`Recovery strategy for ${args.code} (${classification.category}):`);
  console.log(`  Strategy: ${strategy.strategy}`);
  console.log(`  Max retries: ${strategy.maxRetries}`);
  console.log(`  Backoff: ${strategy.backoffMs}ms`);
  console.log(`  Escalate: ${strategy.escalate}`);
  console.log(`  ${strategy.description}`);
  return 0;
}

export async function recoverRewind() {
  const args = parseArgs();
  if (!args.feature || !args.task) {
    console.error('Usage: ogu recover:rewind --feature <slug> --task <failedTaskId>');
    return 1;
  }

  const root = repoRoot();
  const planPath = join(root, `docs/vault/features/${args.feature}/Plan.json`);
  if (!existsSync(planPath)) {
    console.error(`Plan.json not found for feature "${args.feature}"`);
    return 1;
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const dagTasks = (plan.tasks || []).map(t => ({
    taskId: t.id,
    blockedBy: t.dependsOn || [],
  }));
  const dag = buildDAG(dagTasks);

  if (!dag.valid) {
    console.error(`Invalid DAG: ${dag.error}`);
    return 1;
  }

  const rewind = computeRewindPoint(args.task, {
    waves: dag.waves,
    tasks: plan.tasks,
  });

  console.log(`Rewind plan for failed task "${args.task}":`);
  console.log(`  Rewind to wave: ${rewind.rewindToWave}`);
  console.log(`  Tasks to rerun: ${rewind.tasksToRerun.join(', ')}`);
  console.log(`  Reason: ${rewind.reason}`);
  return 0;
}
