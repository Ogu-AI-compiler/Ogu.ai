import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 324 — Merkle Tree Builder + Proof Verifier\x1b[0m\n');
console.log('\x1b[36m  Part 1: Merkle Tree Builder\x1b[0m');
test('merkle-tree-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/merkle-tree-builder.mjs')));
const { createMerkleTreeBuilder } = await import('../../tools/ogu/commands/lib/merkle-tree-builder.mjs');
const mtb = createMerkleTreeBuilder();
test('build tree', () => { const { root, levels } = mtb.build(['a', 'b', 'c', 'd']); assert.ok(root); assert.ok(levels.length > 1); });
test('root is single hash', () => { const { levels } = mtb.build(['a', 'b', 'c', 'd']); assert.equal(levels[levels.length - 1].length, 1); });
test('get proof', () => { const { levels } = mtb.build(['a', 'b', 'c', 'd']); const proof = mtb.getProof(levels, 0); assert.ok(proof.length > 0); });
test('odd leaves handled', () => { const { root } = mtb.build(['a', 'b', 'c']); assert.ok(root); });

console.log('\n\x1b[36m  Part 2: Proof Verifier\x1b[0m');
test('proof-verifier.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/proof-verifier.mjs')));
const { createProofVerifier } = await import('../../tools/ogu/commands/lib/proof-verifier.mjs');
test('verify merkle proof', () => {
  const { root, levels } = mtb.build(['a', 'b', 'c', 'd']);
  const proof = mtb.getProof(levels, 0);
  const leafHash = levels[0][0];
  const pv = createProofVerifier(mtb._hash);
  assert.ok(pv.verifyMerkleProof(leafHash, proof, root));
});
test('reject bad proof', () => {
  const { root, levels } = mtb.build(['a', 'b', 'c', 'd']);
  const proof = mtb.getProof(levels, 0);
  const pv = createProofVerifier(mtb._hash);
  assert.ok(!pv.verifyMerkleProof('badhash', proof, root));
});
test('verify chain', () => {
  const pv = createProofVerifier(mtb._hash);
  const chain = [{ hash: 'a', prev: null }, { hash: 'b', prev: 'a' }, { hash: 'c', prev: 'b' }];
  assert.ok(pv.verifyChain(chain));
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
