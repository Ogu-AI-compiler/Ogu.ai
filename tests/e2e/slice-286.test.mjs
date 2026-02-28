import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 286 — K-Means Cluster + DBSCAN Cluster\x1b[0m\n');

console.log('\x1b[36m  Part 1: K-Means Cluster\x1b[0m');
test('k-means-cluster.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/k-means-cluster.mjs'));
});

const { kMeans } = await import('../../tools/ogu/commands/lib/k-means-cluster.mjs');

test('cluster points into k groups', () => {
  const points = [[1,1],[1,2],[2,1],[10,10],[10,11],[11,10]];
  const result = kMeans(points, 2, 10);
  assert.equal(result.clusters.length, 2);
  assert.equal(result.assignments.length, 6);
});

console.log('\n\x1b[36m  Part 2: DBSCAN Cluster\x1b[0m');
test('dbscan-cluster.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/dbscan-cluster.mjs'));
});

const { dbscan } = await import('../../tools/ogu/commands/lib/dbscan-cluster.mjs');

test('cluster dense regions', () => {
  const points = [[1,1],[1,2],[2,1],[10,10],[10,11],[11,10]];
  const result = dbscan(points, 3, 2);
  assert.ok(result.clusters.length >= 2);
});

test('noise points identified', () => {
  const points = [[0,0],[100,100]];
  const result = dbscan(points, 2, 2);
  assert.ok(result.noise.length > 0);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
