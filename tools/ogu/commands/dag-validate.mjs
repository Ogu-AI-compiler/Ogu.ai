import { buildDAG, parseDeps } from './lib/dag-builder.mjs';

/**
 * ogu dag:validate — Validate a task DAG and compute execution waves.
 *
 * Usage:
 *   ogu dag:validate --tasks A,B,C,D --deps "C:A+B,D:C"
 *   ogu dag:validate --tasks A,B,C,D --deps "C:A+B,D:C" --json
 */
export async function dagValidate() {
  const args = process.argv.slice(3);

  let tasksStr = null;
  let depsStr = null;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tasks' && args[i + 1]) tasksStr = args[++i];
    else if (args[i] === '--deps' && args[i + 1]) depsStr = args[++i];
    else if (args[i] === '--json') jsonOutput = true;
  }

  if (!tasksStr) {
    console.error('Usage: ogu dag:validate --tasks <taskIds> --deps <deps> [--json]');
    return 1;
  }

  const taskIds = tasksStr.split(',').map(s => s.trim());
  const depsMap = parseDeps(depsStr);

  const tasks = taskIds.map(id => ({
    taskId: id,
    blockedBy: depsMap.get(id) || [],
  }));

  const result = buildDAG(tasks);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }

  if (!result.valid) {
    console.error(`DAG invalid: ${result.error}`);
    return 1;
  }

  console.log(`DAG valid: ${result.taskCount} tasks in ${result.waves.length} waves`);
  for (let i = 0; i < result.waves.length; i++) {
    console.log(`  Wave ${i}: ${result.waves[i].join(', ')}`);
  }
  return 0;
}
