import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Global Search Engine — cross-entity search across features, audit, memory.
 *
 * Searches features (name, PRD content, task titles), audit events,
 * and memory entries. Returns scored results.
 */

/**
 * Search across all entities.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.query - Search query
 * @param {string[]} [opts.types] - Filter by entity type ('feature', 'audit', 'task')
 * @param {number} [opts.limit] - Max results (default 20)
 * @returns {Array<{ type, id, title, snippet, score }>}
 */
export function search({ root, query, types, limit } = {}) {
  root = root || repoRoot();
  limit = limit || 20;
  const queryLower = query.toLowerCase();
  const results = [];

  const searchTypes = types || ['feature', 'audit', 'task'];

  // Search features
  if (searchTypes.includes('feature')) {
    searchFeatures(root, queryLower, results);
  }

  // Search audit
  if (searchTypes.includes('audit')) {
    searchAudit(root, queryLower, results);
  }

  // Search tasks within features
  if (searchTypes.includes('task')) {
    searchTasks(root, queryLower, results);
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function searchFeatures(root, query, results) {
  const featuresDir = join(root, 'docs/vault/04_Features');
  if (!existsSync(featuresDir)) return;

  const dirs = readdirSync(featuresDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const slug of dirs) {
    let score = 0;
    let snippet = '';

    // Name match
    if (slug.toLowerCase().includes(query)) {
      score += 5;
      snippet = `Feature: ${slug}`;
    }

    // PRD content match
    const prdPath = join(featuresDir, slug, 'PRD.md');
    if (existsSync(prdPath)) {
      const content = readFileSync(prdPath, 'utf8').toLowerCase();
      if (content.includes(query)) {
        score += 3;
        const idx = content.indexOf(query);
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + query.length + 30);
        snippet = snippet || content.slice(start, end).trim().replace(/\n/g, ' ');
      }
    }

    if (score > 0) {
      results.push({ type: 'feature', id: slug, title: slug, snippet, score });
    }
  }
}

function searchAudit(root, query, results) {
  const logPath = join(root, '.ogu/audit/current.jsonl');
  if (!existsSync(logPath)) return;

  const content = readFileSync(logPath, 'utf8').trim();
  if (!content) return;

  for (const line of content.split('\n')) {
    try {
      const event = JSON.parse(line);
      const eventStr = JSON.stringify(event).toLowerCase();
      if (eventStr.includes(query)) {
        results.push({
          type: 'audit',
          id: event.id || '',
          title: event.type || 'event',
          snippet: eventStr.slice(0, 100),
          score: 2,
        });
      }
    } catch { /* skip */ }
  }
}

function searchTasks(root, query, results) {
  const featuresDir = join(root, 'docs/vault/04_Features');
  if (!existsSync(featuresDir)) return;

  const dirs = readdirSync(featuresDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const slug of dirs) {
    const planPath = join(featuresDir, slug, 'Plan.json');
    if (!existsSync(planPath)) continue;

    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8'));
      for (const task of (plan.tasks || [])) {
        const titleLower = (task.title || '').toLowerCase();
        if (titleLower.includes(query)) {
          results.push({
            type: 'task',
            id: `${slug}:${task.id}`,
            title: task.title,
            snippet: `Feature: ${slug}, Task ${task.id}`,
            score: 4,
          });
        }
      }
    } catch { /* skip */ }
  }
}
