/**
 * Memory Fabric — knowledge graph with pattern indexing and context queries.
 */

/**
 * Create a memory fabric for cross-project pattern storage.
 *
 * @returns {object} Fabric with indexPattern/query/getPatterns/mergeLearnings/removePattern
 */
export function createMemoryFabric() {
  const patterns = [];

  function indexPattern({ name, description, tags = [], content = '' }) {
    patterns.push({
      name,
      description,
      tags,
      content,
      indexedAt: new Date().toISOString(),
    });
  }

  function query(keyword) {
    const kw = keyword.toLowerCase();
    return patterns.filter(p =>
      p.name.toLowerCase().includes(kw) ||
      p.description.toLowerCase().includes(kw) ||
      p.tags.some(t => t.toLowerCase().includes(kw)) ||
      p.content.toLowerCase().includes(kw)
    );
  }

  function getPatterns() {
    return [...patterns];
  }

  function mergeLearnings(externalPatterns) {
    for (const p of externalPatterns) {
      if (!patterns.some(existing => existing.name === p.name)) {
        patterns.push({ ...p });
      }
    }
  }

  function removePattern(name) {
    const idx = patterns.findIndex(p => p.name === name);
    if (idx !== -1) patterns.splice(idx, 1);
  }

  return { indexPattern, query, getPatterns, mergeLearnings, removePattern };
}

// ── File-based module-level API ─────────────────────────────────────────────
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { getMemoryDir } from './runtime-paths.mjs';

function fabricPath(root) {
  return join(getMemoryDir(root), 'fabric.json');
}

function loadFabric(root) {
  const p = fabricPath(root);
  if (!existsSync(p)) return { entities: [], relations: [], indexed: {} };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { entities: [], relations: {}, indexed: {} }; }
}

function saveFabric(root, data) {
  mkdirSync(getMemoryDir(root), { recursive: true });
  writeFileSync(fabricPath(root), JSON.stringify(data, null, 2));
}

/**
 * Add an entity to the fabric.
 * @param {string} root
 * @param {{ type, title, content, tags }} entity
 */
export function addEntity(root, { type, title, content = '', tags = [] }) {
  const fabric = loadFabric(root);
  const entity = { id: randomUUID(), type, title, content, tags, indexedAt: new Date().toISOString() };
  fabric.entities.push(entity);
  saveFabric(root, fabric);
  return entity;
}

/**
 * Query entities by keyword.
 * @param {string} root
 * @param {string} keyword
 */
export function query(root, keyword) {
  const fabric = loadFabric(root);
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  return fabric.entities
    .filter(e => {
      const text = (e.title + ' ' + e.content + ' ' + (e.tags || []).join(' ')).toLowerCase();
      return words.some(w => text.includes(w));
    })
    .map(entity => ({ entity, score: 1 }));
}

/**
 * Index all files in a directory as entities.
 * @param {string} root
 * @param {string} sourceType - entity type to assign
 * @param {string} sourceDir - relative directory path
 */
export function indexSource(root, sourceType, sourceDir) {
  const fabric = loadFabric(root);
  if (!fabric.indexed) fabric.indexed = {};

  const dir = isAbsolute(sourceDir) ? sourceDir : join(root, sourceDir);
  if (!existsSync(dir)) return { indexed: 0, skipped: 0 };

  let indexed = 0, skipped = 0;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.json'))) {
    const key = `${sourceType}::${f}`;
    if (fabric.indexed[key]) { skipped++; continue; }

    try {
      const content = readFileSync(join(dir, f), 'utf8');
      const title = content.split('\n')[0].replace(/^#+ /, '').trim() || f;
      fabric.entities.push({ id: randomUUID(), type: sourceType, title, content: content.slice(0, 2000), tags: [sourceType], indexedAt: new Date().toISOString() });
      fabric.indexed[key] = true;
      indexed++;
    } catch { /* skip */ }
  }

  saveFabric(root, fabric);
  return { indexed, skipped };
}

/**
 * Enrich a prompt with relevant fabric entities.
 */
export function injectContext(root, basePrompt, taskDescription) {
  const results = query(root, taskDescription);
  if (results.length === 0) return { enrichedPrompt: basePrompt, entitiesUsed: 0, sources: [] };

  const top = results.slice(0, 3);
  const context = top.map(r => `[${r.entity.type}] ${r.entity.title}: ${r.entity.content.slice(0, 300)}`).join('\n');
  return {
    enrichedPrompt: `${basePrompt}\n\nRelevant context:\n${context}`,
    entitiesUsed: top.length,
    sources: top.map(r => r.entity.id),
  };
}

/**
 * Get fabric statistics.
 */
export function getStats(root) {
  const fabric = loadFabric(root);
  const typeBreakdown = {};
  for (const e of fabric.entities) {
    typeBreakdown[e.type] = (typeBreakdown[e.type] || 0) + 1;
  }
  return { entityCount: fabric.entities.length, relationCount: (fabric.relations || []).length, typeBreakdown };
}

/**
 * Add a relation between two entities.
 */
export function addRelation(root, fromId, toId, relationType) {
  const fabric = loadFabric(root);
  if (!fabric.relations) fabric.relations = [];
  const relation = { id: randomUUID(), from: fromId, to: toId, type: relationType, createdAt: new Date().toISOString() };
  fabric.relations.push(relation);
  saveFabric(root, fabric);
  return { added: true, relation };
}

/**
 * Get entities related to a given entity.
 */
export function getRelated(root, entityId, depth = 1) {
  const fabric = loadFabric(root);
  const root_entity = fabric.entities.find(e => e.id === entityId);
  if (!root_entity) return { root: null, related: [] };

  const relations = (fabric.relations || []).filter(r => r.from === entityId || r.to === entityId);
  const relatedIds = relations.map(r => r.from === entityId ? r.to : r.from);
  const related = fabric.entities.filter(e => relatedIds.includes(e.id));
  return { root: root_entity, related };
}
