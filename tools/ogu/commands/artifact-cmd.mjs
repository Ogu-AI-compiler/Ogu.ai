import { listArtifacts, loadArtifacts } from './lib/artifact-store.mjs';

/**
 * ogu artifact:list --feature <slug>
 * ogu artifact:get --feature <slug> --task <taskId> [--json]
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { feature: null, task: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--json') result.json = true;
  }
  return result;
}

export async function artifactList() {
  const args = parseArgs();
  if (!args.feature) {
    console.error('Usage: ogu artifact:list --feature <slug>');
    return 1;
  }

  const tasks = listArtifacts(args.feature);

  if (tasks.length === 0) {
    console.log(`No artifacts for "${args.feature}".`);
    return 0;
  }

  console.log(`\n  Artifacts for "${args.feature}" (${tasks.length} tasks):\n`);
  for (const taskId of tasks) {
    const artifact = loadArtifacts(taskId, args.feature);
    const fileCount = artifact?.files?.length || 0;
    const time = artifact?.storedAt?.slice(0, 19) || '?';
    console.log(`  ${taskId.padEnd(24)} ${fileCount} files  ${time}`);
  }
  console.log('');
  return 0;
}

export async function artifactGet() {
  const args = parseArgs();
  if (!args.feature || !args.task) {
    console.error('Usage: ogu artifact:get --feature <slug> --task <taskId> [--json]');
    return 1;
  }

  const artifact = loadArtifacts(args.task, args.feature);
  if (!artifact) {
    console.error(`No artifact found for task "${args.task}" in feature "${args.feature}"`);
    return 1;
  }

  if (args.json) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    console.log(`\n  Artifact: ${args.task} (${args.feature})`);
    console.log(`  Stored: ${artifact.storedAt}`);
    console.log(`  Files: ${artifact.files.length}`);
    for (const f of artifact.files) {
      console.log(`    ${f.path} (${f.content?.length || 0} chars)`);
    }
    if (artifact.metadata && Object.keys(artifact.metadata).length > 0) {
      console.log(`  Metadata: ${JSON.stringify(artifact.metadata)}`);
    }
    console.log('');
  }

  return 0;
}
