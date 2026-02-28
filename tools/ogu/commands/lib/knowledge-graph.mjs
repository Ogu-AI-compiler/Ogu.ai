/**
 * Knowledge Graph — entity-relationship graph with simple RAG-like querying.
 *
 * Stores entities (files, functions, components, APIs, features, agents,
 * contracts) and their relations (imports, exports, calls, implements,
 * tests, owns, depends_on) in a JSON-backed graph.
 *
 * Supports:
 *   - Entity CRUD with typed properties
 *   - Relation management (directed edges)
 *   - Depth-limited graph traversal
 *   - Simple text-based RAG: tokenize query, match against entity
 *     names/properties, rank by TF-IDF-like relevance score
 *
 * Storage:
 *   .ogu/knowledge/graph.json  — entities and relations
 *   .ogu/knowledge/index.json  — search index (inverted token map)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

const KNOWLEDGE_DIR = (root) => join(root, '.ogu/knowledge');
const GRAPH_FILE = (root) => join(KNOWLEDGE_DIR(root), 'graph.json');
const INDEX_FILE = (root) => join(KNOWLEDGE_DIR(root), 'index.json');

const ENTITY_TYPES = ['file', 'function', 'component', 'api_endpoint', 'feature', 'agent', 'contract'];
const RELATION_TYPES = ['imports', 'exports', 'calls', 'implements', 'tests', 'owns', 'depends_on'];

// ── Graph Storage ────────────────────────────────────────────────────

function ensureDir(root) {
  const dir = KNOWLEDGE_DIR(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function loadGraph(root) {
  const path = GRAPH_FILE(root);
  if (!existsSync(path)) {
    return { entities: {}, relations: [], meta: { version: '1.0', updatedAt: null } };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { entities: {}, relations: [], meta: { version: '1.0', updatedAt: null } };
  }
}

function saveGraph(root, graph) {
  ensureDir(root);
  graph.meta = graph.meta || {};
  graph.meta.version = '1.0';
  graph.meta.updatedAt = new Date().toISOString();
  graph.meta.entityCount = Object.keys(graph.entities).length;
  graph.meta.relationCount = (graph.relations || []).length;
  writeFileSync(GRAPH_FILE(root), JSON.stringify(graph, null, 2), 'utf8');
}

function loadIndex(root) {
  const path = INDEX_FILE(root);
  if (!existsSync(path)) return { tokens: {}, entityTokens: {}, builtAt: null };
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { tokens: {}, entityTokens: {}, builtAt: null };
  }
}

function saveIndex(root, index) {
  ensureDir(root);
  index.builtAt = new Date().toISOString();
  writeFileSync(INDEX_FILE(root), JSON.stringify(index, null, 2), 'utf8');
}

// ── Tokenization ─────────────────────────────────────────────────────

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-./]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function entityToTokens(entity) {
  const parts = [
    entity.name || '',
    entity.type || '',
    entity.id || '',
    ...(Object.values(entity.properties || {}).map(v => String(v))),
  ];
  return tokenize(parts.join(' '));
}

// ── Entity CRUD ──────────────────────────────────────────────────────

/**
 * Add or update an entity in the knowledge graph.
 *
 * @param {string} root - Project root
 * @param {object} entity
 * @param {string} entity.type - Entity type (file, function, component, api_endpoint, feature, agent, contract)
 * @param {string} entity.id - Unique entity ID
 * @param {string} entity.name - Human-readable name
 * @param {object} [entity.properties] - Arbitrary key-value properties
 * @param {Array<{ target: string, type: string, metadata?: object }>} [entity.relations] - Relations to add
 * @returns {{ indexed: boolean, entityId: string, relationsAdded: number }}
 */
export function indexEntity(root, { type, id, name, properties, relations }) {
  root = root || repoRoot();
  const graph = loadGraph(root);

  if (!type || !id || !name) {
    return { indexed: false, entityId: id, reason: 'type, id, and name are required' };
  }

  const entityId = id;
  const now = new Date().toISOString();

  // Upsert entity
  const existing = graph.entities[entityId];
  graph.entities[entityId] = {
    id: entityId,
    type,
    name,
    properties: { ...(existing?.properties || {}), ...(properties || {}) },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    hash: createHash('sha256').update(JSON.stringify({ type, id, name, properties })).digest('hex').slice(0, 16),
  };

  // Add relations from the entity definition
  let relationsAdded = 0;
  if (relations && Array.isArray(relations)) {
    for (const rel of relations) {
      const exists = graph.relations.some(r =>
        r.from === entityId && r.to === rel.target && r.type === rel.type
      );
      if (!exists) {
        graph.relations.push({
          from: entityId,
          to: rel.target,
          type: rel.type,
          metadata: rel.metadata || {},
          createdAt: now,
        });
        relationsAdded++;
      }
    }
  }

  saveGraph(root, graph);
  updateIndexForEntity(root, graph.entities[entityId]);

  return { indexed: true, entityId, relationsAdded };
}

/**
 * Remove an entity and all its relations from the graph.
 *
 * @param {string} root - Project root
 * @param {string} entityId - Entity ID to remove
 * @returns {{ removed: boolean, relationsRemoved: number }}
 */
export function removeEntity(root, entityId) {
  root = root || repoRoot();
  const graph = loadGraph(root);

  if (!graph.entities[entityId]) {
    return { removed: false, reason: `Entity ${entityId} not found` };
  }

  delete graph.entities[entityId];

  // Remove all relations involving this entity
  const before = graph.relations.length;
  graph.relations = graph.relations.filter(r => r.from !== entityId && r.to !== entityId);
  const relationsRemoved = before - graph.relations.length;

  saveGraph(root, graph);

  // Update index
  const index = loadIndex(root);
  delete index.entityTokens[entityId];
  // Rebuild token map without this entity
  for (const [token, entityIds] of Object.entries(index.tokens)) {
    index.tokens[token] = entityIds.filter(id => id !== entityId);
    if (index.tokens[token].length === 0) delete index.tokens[token];
  }
  saveIndex(root, index);

  return { removed: true, relationsRemoved };
}

// ── Relations ────────────────────────────────────────────────────────

/**
 * Add a relation between two entities.
 *
 * @param {string} root - Project root
 * @param {object} relation
 * @param {string} relation.from - Source entity ID
 * @param {string} relation.to - Target entity ID
 * @param {string} relation.type - Relation type (imports, exports, calls, implements, tests, owns, depends_on)
 * @param {object} [relation.metadata] - Extra metadata
 * @returns {{ added: boolean, reason?: string }}
 */
export function addRelation(root, { from, to, type, metadata }) {
  root = root || repoRoot();
  const graph = loadGraph(root);

  if (!from || !to || !type) {
    return { added: false, reason: 'from, to, and type are required' };
  }

  // Check for duplicate
  const exists = graph.relations.some(r =>
    r.from === from && r.to === to && r.type === type
  );
  if (exists) {
    return { added: false, reason: 'Relation already exists' };
  }

  graph.relations.push({
    from,
    to,
    type,
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  });

  saveGraph(root, graph);
  return { added: true };
}

// ── Graph Queries ────────────────────────────────────────────────────

/**
 * Query the knowledge graph for entities matching criteria.
 *
 * @param {string} root - Project root
 * @param {object} query
 * @param {string} [query.type] - Filter by entity type
 * @param {string} [query.name] - Filter by name (substring match)
 * @param {string} [query.relations] - Filter by relation type (entities that have this relation)
 * @param {number} [query.depth] - Traverse relations up to this depth (default 1)
 * @returns {Array<{ entity: object, related: object[] }>}
 */
export function queryGraph(root, { type, name, relations: relationType, depth } = {}) {
  root = root || repoRoot();
  const graph = loadGraph(root);
  const maxDepth = depth || 1;

  let candidates = Object.values(graph.entities);

  // Filter by type
  if (type) {
    candidates = candidates.filter(e => e.type === type);
  }

  // Filter by name (substring, case-insensitive)
  if (name) {
    const lower = name.toLowerCase();
    candidates = candidates.filter(e => e.name.toLowerCase().includes(lower));
  }

  // Filter by relation type
  if (relationType) {
    const relatedIds = new Set(
      graph.relations
        .filter(r => r.type === relationType)
        .map(r => r.from)
    );
    candidates = candidates.filter(e => relatedIds.has(e.id));
  }

  // For each candidate, traverse relations up to depth
  return candidates.map(entity => {
    const related = traverseRelations(graph, entity.id, maxDepth);
    return { entity, related };
  });
}

function traverseRelations(graph, entityId, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  const directRelations = graph.relations
    .filter(r => r.from === entityId || r.to === entityId)
    .map(r => {
      const targetId = r.from === entityId ? r.to : r.from;
      const direction = r.from === entityId ? 'outgoing' : 'incoming';
      return {
        relationType: r.type,
        direction,
        targetId,
        entity: graph.entities[targetId] || { id: targetId, name: 'unknown' },
        metadata: r.metadata,
      };
    });

  // Recurse for deeper traversal
  if (currentDepth + 1 < maxDepth) {
    for (const rel of directRelations) {
      rel.nested = traverseRelations(graph, rel.targetId, maxDepth, currentDepth + 1);
    }
  }

  return directRelations;
}

// ── RAG Query ────────────────────────────────────────────────────────

/**
 * Simple text-based retrieval-augmented query.
 *
 * Tokenizes the query, matches against entity names and properties,
 * ranks by relevance score (token overlap / total tokens).
 *
 * @param {string} root - Project root
 * @param {string} query - Natural language query
 * @returns {Array<{ entity: object, score: number, matchedTokens: string[] }>}
 */
export function queryRAG(root, query) {
  root = root || repoRoot();
  const graph = loadGraph(root);
  const index = loadIndex(root);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  // Score each entity by token overlap
  const scores = [];
  const totalEntities = Object.keys(graph.entities).length || 1;

  for (const [entityId, entity] of Object.entries(graph.entities)) {
    const entityToks = index.entityTokens?.[entityId] || entityToTokens(entity);
    const entityTokSet = new Set(entityToks);

    let score = 0;
    const matchedTokens = [];

    for (const qt of queryTokens) {
      if (entityTokSet.has(qt)) {
        // IDF-like boost: rarer tokens score higher
        const docFreq = (index.tokens?.[qt] || []).length || 1;
        const idf = Math.log(totalEntities / docFreq) + 1;
        score += idf;
        matchedTokens.push(qt);
      } else {
        // Partial match — substring bonus
        for (const et of entityToks) {
          if (et.includes(qt) || qt.includes(et)) {
            score += 0.3;
            matchedTokens.push(`~${qt}`);
            break;
          }
        }
      }
    }

    // Normalize by query length
    if (score > 0) {
      scores.push({
        entity,
        score: score / queryTokens.length,
        matchedTokens: [...new Set(matchedTokens)],
      });
    }
  }

  // Sort by score descending, return top 20
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 20);
}

// ── Index Management ─────────────────────────────────────────────────

function updateIndexForEntity(root, entity) {
  const index = loadIndex(root);
  const tokens = entityToTokens(entity);

  // Store entity tokens
  if (!index.entityTokens) index.entityTokens = {};
  index.entityTokens[entity.id] = tokens;

  // Update inverted index
  if (!index.tokens) index.tokens = {};
  for (const token of tokens) {
    if (!index.tokens[token]) index.tokens[token] = [];
    if (!index.tokens[token].includes(entity.id)) {
      index.tokens[token].push(entity.id);
    }
  }

  saveIndex(root, index);
}

/**
 * Rebuild the entire search index from graph data.
 *
 * @param {string} root - Project root
 * @returns {{ entityCount: number, tokenCount: number }}
 */
export function rebuildIndex(root) {
  root = root || repoRoot();
  const graph = loadGraph(root);
  const index = { tokens: {}, entityTokens: {}, builtAt: null };

  for (const entity of Object.values(graph.entities)) {
    const tokens = entityToTokens(entity);
    index.entityTokens[entity.id] = tokens;

    for (const token of tokens) {
      if (!index.tokens[token]) index.tokens[token] = [];
      if (!index.tokens[token].includes(entity.id)) {
        index.tokens[token].push(entity.id);
      }
    }
  }

  saveIndex(root, index);

  return {
    entityCount: Object.keys(graph.entities).length,
    tokenCount: Object.keys(index.tokens).length,
  };
}

// ── Stats ────────────────────────────────────────────────────────────

/**
 * Return graph statistics.
 *
 * @param {string} root - Project root
 * @returns {{ entityCount: number, relationCount: number, typeBreakdown: object, relationTypeBreakdown: object }}
 */
export function getGraphStats(root) {
  root = root || repoRoot();
  const graph = loadGraph(root);

  const entities = Object.values(graph.entities);
  const typeBreakdown = {};
  for (const e of entities) {
    typeBreakdown[e.type] = (typeBreakdown[e.type] || 0) + 1;
  }

  const relationTypeBreakdown = {};
  for (const r of graph.relations) {
    relationTypeBreakdown[r.type] = (relationTypeBreakdown[r.type] || 0) + 1;
  }

  // Connectivity stats
  const inDegree = {};
  const outDegree = {};
  for (const r of graph.relations) {
    outDegree[r.from] = (outDegree[r.from] || 0) + 1;
    inDegree[r.to] = (inDegree[r.to] || 0) + 1;
  }

  const degrees = entities.map(e => (outDegree[e.id] || 0) + (inDegree[e.id] || 0));
  const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
  const isolatedCount = degrees.filter(d => d === 0).length;

  return {
    entityCount: entities.length,
    relationCount: graph.relations.length,
    typeBreakdown,
    relationTypeBreakdown,
    connectivity: {
      avgDegree: Math.round(avgDegree * 100) / 100,
      maxDegree,
      isolatedEntities: isolatedCount,
    },
    supportedEntityTypes: ENTITY_TYPES,
    supportedRelationTypes: RELATION_TYPES,
  };
}
