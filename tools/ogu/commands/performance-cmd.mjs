import { computeAgentMetrics, computeOrgPerformance } from './lib/performance-index.mjs';
import { generateStandup } from './lib/standup-generator.mjs';

/**
 * ogu performance:index [--json]
 */
export async function performanceIndex() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const metrics = computeAgentMetrics();

  if (jsonOutput) {
    console.log(JSON.stringify(metrics, null, 2));
    return 0;
  }

  const perf = computeOrgPerformance();

  console.log(`\n  Performance Index\n`);
  console.log(`  Org: ${perf.totalTasks} tasks, ${(perf.overallSuccessRate * 100).toFixed(0)}% success, $${perf.totalCost.toFixed(2)} total\n`);

  for (const m of metrics) {
    console.log(`  ${m.roleId.padEnd(15)} ${m.totalTasks} tasks  ${(m.successRate * 100).toFixed(0)}% success  $${m.costPerTask.toFixed(2)}/task  ${m.tokensPerTask} tok/task`);
  }
  console.log('');

  return 0;
}

/**
 * ogu kadima:standup [--hours <N>] [--json]
 */
export async function kadimaStandup() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const hoursIdx = args.indexOf('--hours');
  const hoursBack = hoursIdx >= 0 ? parseInt(args[hoursIdx + 1], 10) : 24;

  const standup = generateStandup({ hoursBack });

  if (jsonOutput) {
    console.log(JSON.stringify(standup, null, 2));
    return 0;
  }

  console.log(`\n  Daily Standup — ${standup.date} (last ${standup.hoursBack}h)\n`);

  if (standup.completed.length > 0) {
    console.log(`  Completed (${standup.completed.length}):`);
    for (const t of standup.completed) {
      console.log(`    ✓ ${t.taskId || '?'} [${t.feature || '?'}] by ${t.roleId || '?'}`);
    }
  }

  if (standup.failed.length > 0) {
    console.log(`  Failed (${standup.failed.length}):`);
    for (const t of standup.failed) {
      console.log(`    ✗ ${t.taskId || '?'} [${t.feature || '?'}]: ${t.error || '?'}`);
    }
  }

  if (standup.transitions.length > 0) {
    console.log(`  Transitions:`);
    for (const t of standup.transitions) {
      console.log(`    → ${t.detail} [${t.feature || '?'}]`);
    }
  }

  console.log('');
  return 0;
}
