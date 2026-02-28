import { searchMemory, listMemories, storeMemory } from './lib/semantic-memory.mjs';

/**
 * ogu memory:search <query> [--tag <tag>] [--json]
 */
export async function memorySearch() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const tags = [];
  let query = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) { tags.push(args[++i]); continue; }
    if (args[i] === '--json') continue;
    if (!query && !args[i].startsWith('--')) query = args[i];
  }

  const results = searchMemory({ query, tags: tags.length > 0 ? tags : undefined });

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Memory search: ${results.length} result(s)\n`);
    for (const r of results) {
      console.log(`  [${r.category}] ${r.content.slice(0, 80)} (score: ${r.score})`);
    }
  }
  return 0;
}

/**
 * ogu memory:list [--category <cat>] [--json]
 */
export async function memoryList() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  let category = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) category = args[++i];
  }

  const entries = listMemories({ category });

  if (jsonOutput) {
    console.log(JSON.stringify(entries, null, 2));
  } else {
    console.log(`Memory entries: ${entries.length}\n`);
    for (const e of entries) {
      console.log(`  [${e.category}] ${e.content.slice(0, 80)}`);
      if (e.tags.length > 0) console.log(`    tags: ${e.tags.join(', ')}`);
    }
  }
  return 0;
}

/**
 * ogu memory:store <content> [--tag <tag>...] [--category <cat>]
 */
export async function memoryStore() {
  const args = process.argv.slice(3);
  const tags = [];
  let category = 'insight';
  let content = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) { tags.push(args[++i]); continue; }
    if (args[i] === '--category' && args[i + 1]) { category = args[++i]; continue; }
    if (!content && !args[i].startsWith('--')) content = args[i];
  }

  if (!content) {
    console.error('Usage: ogu memory:store <content> [--tag <tag>] [--category <cat>]');
    return 1;
  }

  const entry = storeMemory({ content, tags, category, source: 'cli' });
  console.log(`Stored memory: ${entry.id.slice(0, 8)}`);
  return 0;
}
