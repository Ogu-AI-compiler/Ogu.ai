/**
 * Memory Fabric CLI Commands — context injection and entry merging.
 *
 * memory:fabric:inject --prompt <text> --task <description> [--max-entities N] [--max-tokens N]
 * memory:merge --source <path|url> [--type <sourceType>]
 */

import { repoRoot } from '../util.mjs';
import { injectContext, indexSource, getStats, query } from './lib/memory-fabric.mjs';

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { prompt: null, task: null, source: null, type: null, maxEntities: 5, maxTokens: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) { result.prompt = args[++i]; continue; }
    if (args[i] === '--task' && args[i + 1]) { result.task = args[++i]; continue; }
    if (args[i] === '--source' && args[i + 1]) { result.source = args[++i]; continue; }
    if (args[i] === '--type' && args[i + 1]) { result.type = args[++i]; continue; }
    if (args[i] === '--max-entities' && args[i + 1]) { result.maxEntities = parseInt(args[++i], 10); continue; }
    if (args[i] === '--max-tokens' && args[i + 1]) { result.maxTokens = parseInt(args[++i], 10); continue; }
    if (args[i] === '--json') { result.json = true; continue; }
  }
  return result;
}

/**
 * ogu memory:fabric:inject --prompt <text> --task <description> [--max-entities N] [--max-tokens N] [--json]
 *
 * Search the memory fabric for relevant context matching the task description,
 * then inject it into the given agent prompt. Outputs the enriched prompt.
 */
export async function memoryFabricInject() {
  const root = repoRoot();
  const { prompt, task, maxEntities, maxTokens, json } = parseArgs();

  if (!prompt || !task) {
    console.error('Usage: ogu memory:fabric:inject --prompt <text> --task <description> [--max-entities N] [--max-tokens N]');
    return 1;
  }

  const options = { maxEntities };
  if (maxTokens) options.maxTokens = maxTokens;

  const result = injectContext(root, prompt, task, options);

  if (json) {
    console.log(JSON.stringify({
      entitiesUsed: result.entitiesUsed,
      sources: result.sources,
      enrichedPromptLength: result.enrichedPrompt.length,
      enrichedPrompt: result.enrichedPrompt,
    }, null, 2));
    return 0;
  }

  console.log('MEMORY FABRIC INJECTION');
  console.log('');
  console.log(`  Task: ${task}`);
  console.log(`  Entities matched: ${result.entitiesUsed}`);
  console.log(`  Sources: ${result.sources.length > 0 ? result.sources.join(', ') : 'none'}`);
  console.log('');

  if (result.entitiesUsed > 0) {
    console.log('  --- Enriched Prompt ---');
    console.log(result.enrichedPrompt);
    console.log('  --- End ---');
  } else {
    console.log('  No relevant context found in memory fabric.');
    console.log('  Original prompt returned unchanged.');
  }

  // Show fabric stats
  const stats = getStats(root);
  console.log('');
  console.log(`  Fabric: ${stats.entityCount} entities, ${stats.relationCount} relations`);

  return 0;
}

/**
 * ogu memory:merge --source <path> [--type <sourceType>] [--json]
 *
 * Index a source file or directory into the memory fabric, merging
 * its contents as new entities with auto-detected relations.
 */
export async function memoryMerge() {
  const root = repoRoot();
  const { source, type, json } = parseArgs();

  if (!source) {
    console.error('Usage: ogu memory:merge --source <path> [--type <sourceType>]');
    return 1;
  }

  const sourceType = type || 'file';
  const result = indexSource(root, sourceType, source);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log('MEMORY FABRIC MERGE');
  console.log('');
  console.log(`  Source: ${source}`);
  console.log(`  Type: ${sourceType}`);
  console.log(`  Entities added: ${result.entitiesAdded || 0}`);
  console.log(`  Relations added: ${result.relationsAdded || 0}`);
  console.log(`  Duplicates skipped: ${result.duplicatesSkipped || 0}`);

  // Show updated stats
  const stats = getStats(root);
  console.log('');
  console.log(`  Fabric totals: ${stats.entityCount} entities, ${stats.relationCount} relations`);

  return 0;
}
