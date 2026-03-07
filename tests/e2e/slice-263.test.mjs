import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 263 — Token Bucket\x1b[0m\n');

console.log('\x1b[36m  Part 1: Token Bucket\x1b[0m');
test('token-bucket.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/token-bucket.mjs'));
});

const { createTokenBucket } = await import('../../tools/ogu/commands/lib/token-bucket.mjs');

test('consume tokens', () => {
  const tb = createTokenBucket({ capacity: 10, tokensPerInterval: 1 });
  assert.ok(tb.consume(5));
  assert.equal(tb.getTokens(), 5);
});

test('reject when insufficient', () => {
  const tb = createTokenBucket({ capacity: 3, tokensPerInterval: 1 });
  assert.ok(!tb.consume(5));
});

test('refill adds tokens', () => {
  const tb = createTokenBucket({ capacity: 10, tokensPerInterval: 3 });
  tb.consume(8);
  tb.refill();
  assert.equal(tb.getTokens(), 5);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
