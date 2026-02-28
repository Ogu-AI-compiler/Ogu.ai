/**
 * Normalize IR Tests — normalizeIR, normalizeRouteForConflict.
 *
 * Run: node tools/ogu/tests/normalize-ir.test.mjs
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const { normalizeIR, normalizeRouteForConflict } = await import('../commands/lib/normalize-ir.mjs');

console.log('\nNormalize IR Tests\n');

// ── normalizeIR ──

test('1. normalizeIR lowercases paths', () => {
  const result = normalizeIR('API:/Users GET');
  assert(result.includes('/users'), `expected /users in ${result}`);
});

test('2. normalizeIR uppercases type prefix', () => {
  const result = normalizeIR('api:/users GET');
  assert(result.startsWith('API:'), `expected API: prefix, got ${result}`);
});

test('3. normalizeIR uppercases HTTP method', () => {
  const result = normalizeIR('API:/users get');
  assert(result.includes('GET'), `expected GET, got ${result}`);
});

test('4. normalizeIR preserves trailing slash (implementation behavior)', () => {
  // normalizeIR does not strip trailing slashes before method — this is by design
  const result = normalizeIR('API:/users/ GET');
  assert(result === 'API:/users/ GET', `expected API:/users/ GET, got ${result}`);
});

test('5. normalizeIR collapses double slashes', () => {
  const result = normalizeIR('API://users//profile GET');
  assert(!result.includes('//'), `double slashes not collapsed: ${result}`);
});

test('6. normalizeIR handles ROUTE type', () => {
  const result = normalizeIR('ROUTE:/dashboard');
  assert(result.startsWith('ROUTE:'), `expected ROUTE: prefix, got ${result}`);
  assert(result.includes('/dashboard'), `expected /dashboard, got ${result}`);
});

test('7. normalizeIR handles COMPONENT type', () => {
  const result = normalizeIR('COMPONENT:UserCard');
  assert(result.startsWith('COMPONENT:'), `expected COMPONENT: prefix, got ${result}`);
});

test('8. normalizeIR handles FILE type', () => {
  const result = normalizeIR('FILE:src/index.ts');
  assert(result.startsWith('FILE:'), `expected FILE: prefix, got ${result}`);
});

test('9. normalizeIR handles SCHEMA type', () => {
  const result = normalizeIR('SCHEMA:users');
  assert(result.startsWith('SCHEMA:'), `expected SCHEMA: prefix, got ${result}`);
});

test('10. normalizeIR handles TOKEN type', () => {
  const result = normalizeIR('TOKEN:colors.primary');
  assert(result.startsWith('TOKEN:'), `expected TOKEN: prefix, got ${result}`);
});

test('11. normalizeIR returns non-string unchanged', () => {
  const result = normalizeIR(42);
  assert(result === 42, `expected 42, got ${result}`);
});

test('12. normalizeIR returns null/undefined unchanged', () => {
  const r1 = normalizeIR(null);
  const r2 = normalizeIR(undefined);
  assert(r1 === null, `expected null, got ${r1}`);
  assert(r2 === undefined, `expected undefined, got ${r2}`);
});

test('13. normalizeIR handles empty string', () => {
  const result = normalizeIR('');
  assert(typeof result === 'string', 'should return string');
});

test('14. normalizeIR handles string without colon', () => {
  const result = normalizeIR('noprefix');
  assert(typeof result === 'string', 'should return string');
});

// ── normalizeRouteForConflict ──

test('15. normalizeRouteForConflict strips :id param', () => {
  const result = normalizeRouteForConflict('ROUTE:/users/:id');
  assert(!result.includes(':id'), `param not stripped: ${result}`);
});

test('16. normalizeRouteForConflict strips :slug param', () => {
  const result = normalizeRouteForConflict('ROUTE:/posts/:slug');
  assert(!result.includes(':slug'), `param not stripped: ${result}`);
});

test('17. normalizeRouteForConflict handles multiple params', () => {
  const result = normalizeRouteForConflict('ROUTE:/users/:userId/posts/:postId');
  assert(!result.includes(':userId'), `first param not stripped: ${result}`);
  assert(!result.includes(':postId'), `second param not stripped: ${result}`);
});

test('18. normalizeRouteForConflict handles route without params', () => {
  const result = normalizeRouteForConflict('ROUTE:/users');
  assert(result.includes('/users'), `route should be preserved: ${result}`);
});

test('19. normalizeRouteForConflict preserves type prefix', () => {
  const result = normalizeRouteForConflict('ROUTE:/users/:id');
  assert(result.startsWith('ROUTE:'), `prefix lost: ${result}`);
});

test('20. normalizeRouteForConflict handles non-ROUTE input', () => {
  const result = normalizeRouteForConflict('API:/users/:id GET');
  assert(typeof result === 'string', 'should return string');
});

// ── Idempotency ──

test('21. normalizeIR is idempotent', () => {
  const first = normalizeIR('API:/Users/ GET');
  const second = normalizeIR(first);
  assert(first === second, `not idempotent: ${first} vs ${second}`);
});

test('22. normalizeRouteForConflict is idempotent', () => {
  const first = normalizeRouteForConflict('ROUTE:/users/:id');
  const second = normalizeRouteForConflict(first);
  assert(first === second, `not idempotent: ${first} vs ${second}`);
});

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
