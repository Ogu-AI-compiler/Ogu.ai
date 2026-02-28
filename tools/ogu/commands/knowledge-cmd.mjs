import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

/**
 * ogu knowledge:index [--feature <slug>]  — Index knowledge from completed features
 * ogu knowledge:query <term>              — Search knowledge base
 */

export async function knowledgeIndex() {
  const root = repoRoot();
  const args = process.argv.slice(3);
  let featureSlug = null;
  const fIdx = args.indexOf('--feature');
  if (fIdx !== -1 && args[fIdx + 1]) featureSlug = args[fIdx + 1];

  // Import semantic memory if available
  let indexFn;
  try {
    const mod = await import('./lib/semantic-memory.mjs');
    indexFn = mod.indexFeatureKnowledge || mod.indexKnowledge;
  } catch {
    console.error('semantic-memory.mjs not available.');
    return 1;
  }

  if (!indexFn) {
    // Fallback: scan memory files
    const memoryDir = join(root, '.ogu/memory');
    if (!existsSync(memoryDir)) {
      console.log('  No memory directory found.');
      return 0;
    }
    const files = readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    console.log(`\n  Knowledge Index — ${files.length} memory files\n`);
    for (const f of files) {
      const content = readFileSync(join(memoryDir, f), 'utf8');
      const lines = content.split('\n').filter(Boolean).length;
      console.log(`  ${f.padEnd(30)} ${lines} lines`);
    }
    return 0;
  }

  try {
    const result = indexFn(root, featureSlug);
    console.log(`  Indexed: ${result?.indexed || 0} entries`);
    return 0;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }
}

export async function knowledgeQuery() {
  const term = process.argv.slice(3).join(' ');
  if (!term) {
    console.error('Usage: ogu knowledge:query <term>');
    return 1;
  }

  const root = repoRoot();

  // Try semantic search first
  try {
    const mod = await import('./lib/semantic-memory.mjs');
    if (mod.searchKnowledge) {
      const results = mod.searchKnowledge(root, term);
      if (results?.length > 0) {
        console.log(`\n  Knowledge Query: "${term}" — ${results.length} results\n`);
        for (const r of results.slice(0, 10)) {
          console.log(`  ${(r.source || '').padEnd(30)} score=${(r.score || 0).toFixed(2)}  ${r.summary || ''}`);
        }
        return 0;
      }
    }
  } catch { /* fallback below */ }

  // Fallback: grep memory files
  const memoryDir = join(root, '.ogu/memory');
  if (!existsSync(memoryDir)) {
    console.log('  No knowledge base found.');
    return 0;
  }

  const files = readdirSync(memoryDir).filter(f => f.endsWith('.md'));
  const matches = [];
  const termLower = term.toLowerCase();

  for (const f of files) {
    const content = readFileSync(join(memoryDir, f), 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(termLower)) {
        matches.push({ file: f, line: i + 1, text: lines[i].trim() });
      }
    }
  }

  if (matches.length === 0) {
    console.log(`  No results for "${term}".`);
    return 0;
  }

  console.log(`\n  Knowledge Query: "${term}" — ${matches.length} matches\n`);
  for (const m of matches.slice(0, 20)) {
    console.log(`  ${m.file}:${m.line}  ${m.text.slice(0, 80)}`);
  }
  return 0;
}
