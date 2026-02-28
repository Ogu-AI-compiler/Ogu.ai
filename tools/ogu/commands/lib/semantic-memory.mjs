import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Semantic Memory Fabric — file-based memory with tags and search.
 *
 * Stores knowledge entries with tags, categories, and relevance scoring.
 * Enables RAG-like pattern retrieval for agent decision-making.
 * Stored in .ogu/memory/fabric.json.
 */

function fabricPath(root) {
  const dir = join(root, '.ogu/memory');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'fabric.json');
}

function loadFabric(root) {
  const p = fabricPath(root);
  if (!existsSync(p)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function saveFabric(root, fabric) {
  writeFileSync(fabricPath(root), JSON.stringify(fabric, null, 2));
}

/**
 * Store a memory entry.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.content - The knowledge to store
 * @param {string[]} opts.tags - Semantic tags
 * @param {string} opts.source - Where this knowledge came from
 * @param {string} opts.category - 'pattern' | 'decision' | 'insight' | 'error'
 * @returns {{ id, content, tags, source, category, createdAt }}
 */
export function storeMemory({ root, content, tags, source, category } = {}) {
  root = root || repoRoot();
  const fabric = loadFabric(root);

  const entry = {
    id: randomUUID(),
    content,
    tags: tags || [],
    source: source || 'unknown',
    category: category || 'insight',
    createdAt: new Date().toISOString(),
  };

  fabric.entries.push(entry);
  saveFabric(root, fabric);
  return entry;
}

/**
 * Search memory entries by tags and/or keyword query.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string[]} [opts.tags] - Tags to match
 * @param {string} [opts.query] - Keyword search in content
 * @param {string} [opts.category] - Filter by category
 * @param {number} [opts.limit] - Max results (default 20)
 * @returns {Array<{ ...entry, score: number }>}
 */
export function searchMemory({ root, tags, query, category, limit } = {}) {
  root = root || repoRoot();
  const fabric = loadFabric(root);
  limit = limit || 20;

  const results = [];

  for (const entry of fabric.entries) {
    let score = 0;

    // Category filter (hard filter)
    if (category && entry.category !== category) continue;

    // Tag matching
    if (tags && tags.length > 0) {
      const matchedTags = tags.filter(t =>
        entry.tags.some(et => et.toLowerCase() === t.toLowerCase())
      );
      score += matchedTags.length * 2;
    }

    // Keyword matching in content
    if (query) {
      const queryLower = query.toLowerCase();
      const contentLower = entry.content.toLowerCase();
      const words = queryLower.split(/\s+/);

      for (const word of words) {
        if (contentLower.includes(word)) {
          score += 1;
        }
      }

      // Exact phrase bonus
      if (contentLower.includes(queryLower)) {
        score += 3;
      }
    }

    // If no criteria given, return all with base score
    if (!tags && !query) {
      score = 1;
    }

    if (score > 0) {
      results.push({ ...entry, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * List all memory entries.
 */
export function listMemories({ root, category } = {}) {
  root = root || repoRoot();
  const fabric = loadFabric(root);
  if (category) {
    return fabric.entries.filter(e => e.category === category);
  }
  return fabric.entries;
}

/**
 * Delete a memory entry by ID.
 */
export function deleteMemory({ root, id } = {}) {
  root = root || repoRoot();
  const fabric = loadFabric(root);
  const before = fabric.entries.length;
  fabric.entries = fabric.entries.filter(e => e.id !== id);
  saveFabric(root, fabric);
  return fabric.entries.length < before;
}
