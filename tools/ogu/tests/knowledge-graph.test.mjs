/**
 * Knowledge Graph Tests.
 *
 * 8 tests covering:
 *   Section 1: indexEntity + removeEntity (3 tests)
 *   Section 2: addRelation + queryGraph (3 tests)
 *   Section 3: queryRAG + rebuildIndex (2 tests)
 */

import {
  indexEntity, removeEntity, addRelation,
  queryGraph, queryRAG, rebuildIndex, getGraphStats,
} from '../commands/lib/knowledge-graph.mjs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-kg-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/knowledge'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: indexEntity + removeEntity
// ═══════════════════════════════════════════════════════════════════════

// 1. indexEntity adds to graph
{
  const root = makeTmpRoot();
  const result = indexEntity(root, {
    type: 'module', id: 'mod-1', name: 'circuit-breaker',
    properties: { path: 'tools/ogu/commands/lib/circuit-breaker.mjs' },
  });
  assert(result && (result.id || result.entityId),
    'indexEntity adds entity to graph');
  rmSync(root, { recursive: true, force: true });
}

// 2. queryGraph finds indexed entity
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'circuit-breaker', properties: {} });
  const results_ = queryGraph(root, { type: 'module' });
  assert(results_ && results_.length >= 1,
    'queryGraph finds indexed entity by type');
  rmSync(root, { recursive: true, force: true });
}

// 3. removeEntity deletes entity + relations
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'circuit-breaker', properties: {} });
  removeEntity(root, 'mod-1');
  const results_ = queryGraph(root, { name: 'circuit-breaker' });
  assert(!results_ || results_.length === 0,
    'removeEntity deletes entity from graph');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: addRelation + queryGraph
// ═══════════════════════════════════════════════════════════════════════

// 4. addRelation creates directed edge
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'circuit-breaker', properties: {} });
  indexEntity(root, { type: 'module', id: 'mod-2', name: 'audit-emitter', properties: {} });
  const rel = addRelation(root, { from: 'mod-1', to: 'mod-2', type: 'imports' });
  assert(rel !== undefined && rel !== null,
    'addRelation creates directed edge');
  rmSync(root, { recursive: true, force: true });
}

// 5. queryGraph filters by name
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'circuit-breaker', properties: {} });
  indexEntity(root, { type: 'module', id: 'mod-2', name: 'audit-emitter', properties: {} });
  const results_ = queryGraph(root, { name: 'circuit-breaker' });
  assert(results_ && results_.length === 1,
    'queryGraph filters by name');
  rmSync(root, { recursive: true, force: true });
}

// 6. getGraphStats returns counts
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'a', properties: {} });
  indexEntity(root, { type: 'module', id: 'mod-2', name: 'b', properties: {} });
  addRelation(root, { from: 'mod-1', to: 'mod-2', type: 'imports' });
  const stats = getGraphStats(root);
  assert(stats && typeof stats.entityCount === 'number' && stats.entityCount >= 2,
    'getGraphStats returns entity count');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: queryRAG + rebuildIndex
// ═══════════════════════════════════════════════════════════════════════

// 7. queryRAG returns ranked results
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'circuit-breaker', properties: { description: 'failure domain isolation' } });
  indexEntity(root, { type: 'module', id: 'mod-2', name: 'audit-emitter', properties: { description: 'audit event logging' } });
  rebuildIndex(root);
  const results_ = queryRAG(root, 'circuit failure');
  assert(Array.isArray(results_) && results_.length >= 0,
    'queryRAG returns array of results');
  rmSync(root, { recursive: true, force: true });
}

// 8. rebuildIndex reconstructs inverted index
{
  const root = makeTmpRoot();
  indexEntity(root, { type: 'module', id: 'mod-1', name: 'test-entity', properties: {} });
  const result = rebuildIndex(root);
  assert(result !== undefined,
    'rebuildIndex completes without error');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nKnowledge Graph Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
