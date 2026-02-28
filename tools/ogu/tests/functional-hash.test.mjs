/**
 * Functional Hash Tests.
 *
 * 8 tests covering:
 *   Section 1: computeFunctionalHash (3 tests)
 *   Section 2: detectDrift (3 tests)
 *   Section 3: equivalenceLevel (2 tests)
 */

import { computeFunctionalHash, detectDrift, equivalenceLevel } from '../commands/lib/functional-hash.mjs';

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

const code1 = `function hello() {
  return 'hello';
}`;

const code1Whitespace = `  function hello() {
    return 'hello';
  }`;

const code1Renamed = `function hello() {
  const msg = 'hello';
  return msg;
}`;

const code1StringChange = `function hello() {
  return 'world';
}`;

const code2 = `function goodbye() {
  return 'bye';
}`;

// ═══════════════════════════════════════════════════════════════════════
// Section 1: computeFunctionalHash
// ═══════════════════════════════════════════════════════════════════════

// 1. L0: identical content → same hash
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code1, 'javascript');
  assert(h1 && h2 && h1.hashes.l0 === h2.hashes.l0, 'L0: identical content → same hash');
}

// 2. L1: whitespace/comment diff → same L1 hash
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code1Whitespace, 'javascript');
  assert(h1 && h2 && h1.hashes.l1 === h2.hashes.l1,
    'L1: whitespace/comment diff → same L1 hash');
}

// 3. L0 changes when content changes
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code2, 'javascript');
  assert(h1 && h2 && h1.hashes.l0 !== h2.hashes.l0,
    'L0: different content → different hash');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: detectDrift
// ═══════════════════════════════════════════════════════════════════════

// 4. detectDrift reports no drift for identical content
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code1, 'javascript');
  const drift = detectDrift(h1, h2);
  assert(drift && (drift.drifted === false || drift.severity === 'none' || drift.level === 'L0'),
    'detectDrift reports no drift for identical content');
}

// 5. detectDrift reports drift for structural change
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code2, 'javascript');
  const drift = detectDrift(h1, h2);
  assert(drift && (drift.drifted === true || drift.severity === 'high' || drift.severity === 'critical'),
    'detectDrift reports drift for structural change');
}

// 6. detectDrift reports correct severity
{
  const h1 = computeFunctionalHash(code1, 'javascript');
  const h2 = computeFunctionalHash(code1StringChange, 'javascript');
  const drift = detectDrift(h1, h2);
  assert(drift && drift.severity,
    'detectDrift has severity field');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: equivalenceLevel
// ═══════════════════════════════════════════════════════════════════════

// 7. equivalenceLevel returns L0 for identical content
{
  const level = equivalenceLevel(code1, code1);
  assert(level && (level.label === 'L0' || level.level === 0),
    'equivalenceLevel returns L0 for identical content');
}

// 8. equivalenceLevel returns higher level for structural changes
{
  const level = equivalenceLevel(code1, code2);
  assert(level && (level.label === 'L4' || level.level === 4),
    'equivalenceLevel returns L4/none for structural changes');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nFunctional Hash Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
