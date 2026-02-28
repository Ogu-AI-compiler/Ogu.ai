/**
 * Determinism Tests — tolerance, validator, ledger.
 *
 * Run: node tools/ogu/tests/determinism.test.mjs
 */

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Import modules
const {
  computeDivergence, classifyDivergence, isWithinTolerance, TOLERANCE_LEVELS,
} = await import('../commands/lib/determinism-tolerance.mjs');

const {
  classifyOperation, validateDeterminism, compareOutputs,
  recordViolation, loadLedger, analyzeLedger,
} = await import('../commands/lib/determinism-validator.mjs');

const testRoot = join(tmpdir(), `ogu-det-test-${randomUUID().slice(0, 8)}`);
mkdirSync(testRoot, { recursive: true });

console.log('\nDeterminism Tests\n');

// ── Tolerance ──

test('1. computeDivergence: identical strings → score 1.0', () => {
  const r = computeDivergence({ expected: 'hello world', actual: 'hello world' });
  assert(r.score === 1.0, `Expected 1.0, got ${r.score}`);
  assert(r.divergent === false, 'Should not be divergent');
});

test('2. computeDivergence: slightly different → partial score', () => {
  const r = computeDivergence({
    expected: 'function add(a, b) { return a + b; }',
    actual: 'function add(x, y) { return x + y; }',
  });
  // Tokenizer splits on symbols so a/b → x/y are different tokens; LCS matches 'function','add','return' = 3/7
  assert(r.score > 0.3, `Score should be > 0.3, got ${r.score}`);
  assert(r.score < 1.0, 'Score should be < 1.0');
  assert(r.divergent === true, 'Should be divergent');
});

test('3. computeDivergence: completely different → low score', () => {
  const r = computeDivergence({ expected: 'alpha beta gamma', actual: 'one two three four five' });
  assert(r.score < 0.3, `Score should be < 0.3, got ${r.score}`);
});

test('4. classifyDivergence: identical → "identical"', () => {
  const r = classifyDivergence({ expected: 'abc', actual: 'abc' });
  assert(r.type === 'identical', `Expected identical, got ${r.type}`);
});

test('5. classifyDivergence: whitespace only → "cosmetic"', () => {
  const r = classifyDivergence({ expected: 'a  b\n  c', actual: 'a b c' });
  assert(r.type === 'cosmetic', `Expected cosmetic, got ${r.type}`);
});

test('6. classifyDivergence: similar content → "structural"', () => {
  const r = classifyDivergence({
    expected: 'function foo() { return bar(); }',
    actual: 'function foo() { return baz(); }',
  });
  assert(r.type === 'structural' || r.type === 'semantic', `Expected structural/semantic, got ${r.type}`);
});

test('7. isWithinTolerance: checks against level threshold', () => {
  assert(isWithinTolerance(0.95, 'normal') === true, '0.95 within normal (0.90)');
  assert(isWithinTolerance(0.85, 'normal') === false, '0.85 not within normal');
  assert(isWithinTolerance(0.85, 'relaxed') === true, '0.85 within relaxed (0.70)');
  assert(isWithinTolerance(0.999, 'strict') === true, '0.999 within strict (0.99)');
  assert(isWithinTolerance(0.98, 'strict') === false, '0.98 not within strict');
});

test('8. TOLERANCE_LEVELS has all 4 levels', () => {
  assert(TOLERANCE_LEVELS.strict, 'Should have strict');
  assert(TOLERANCE_LEVELS.normal, 'Should have normal');
  assert(TOLERANCE_LEVELS.relaxed, 'Should have relaxed');
  assert(TOLERANCE_LEVELS.permissive, 'Should have permissive');
});

// ── Validator: operations ──

test('9. classifyOperation: deterministic types', () => {
  assert(classifyOperation({ type: 'file_read' }) === 'deterministic', 'file_read is deterministic');
  assert(classifyOperation({ type: 'compute' }) === 'deterministic', 'compute is deterministic');
});

test('10. classifyOperation: non-deterministic types', () => {
  assert(classifyOperation({ type: 'random' }) === 'non-deterministic', 'random');
  assert(classifyOperation({ type: 'timestamp' }) === 'non-deterministic', 'timestamp');
  assert(classifyOperation({ type: 'uuid' }) === 'non-deterministic', 'uuid');
  assert(classifyOperation({ type: 'network' }) === 'non-deterministic', 'network');
});

test('11. validateDeterminism: clean log', () => {
  const r = validateDeterminism({
    operations: [
      { type: 'file_read' },
      { type: 'compute' },
      { type: 'file_write' },
    ],
  });
  assert(r.isDeterministic === true, 'Should be deterministic');
  assert(r.violations.length === 0, 'No violations');
  assert(r.totalOperations === 3, 'Should count operations');
});

test('12. validateDeterminism: violations detected', () => {
  const r = validateDeterminism({
    operations: [
      { type: 'file_read' },
      { type: 'random' },
      { type: 'timestamp' },
    ],
  });
  assert(r.isDeterministic === false, 'Should not be deterministic');
  assert(r.violations.length === 2, `Expected 2 violations, got ${r.violations.length}`);
  assert(r.violations[0].type === 'random', 'First violation is random');
  assert(r.violations[1].type === 'timestamp', 'Second violation is timestamp');
});

// ── Validator: compareOutputs ──

test('13. compareOutputs: identical files → deterministic', () => {
  const r = compareOutputs({
    expected: [{ path: 'a.ts', content: 'export const x = 1;' }],
    actual: [{ path: 'a.ts', content: 'export const x = 1;' }],
  });
  assert(r.deterministic === true, 'Should be deterministic');
  assert(r.overallScore === 1.0, `Score should be 1.0, got ${r.overallScore}`);
  assert(r.fileResults[0].status === 'identical', 'File status should be identical');
});

test('14. compareOutputs: missing file → not deterministic', () => {
  const r = compareOutputs({
    expected: [
      { path: 'a.ts', content: 'const a = 1;' },
      { path: 'b.ts', content: 'const b = 2;' },
    ],
    actual: [
      { path: 'a.ts', content: 'const a = 1;' },
    ],
  });
  assert(r.deterministic === false, 'Should not be deterministic');
  assert(r.fileResults.some(f => f.status === 'missing'), 'Should have missing file');
});

test('15. compareOutputs: extra file → not deterministic', () => {
  const r = compareOutputs({
    expected: [{ path: 'a.ts', content: 'const a = 1;' }],
    actual: [
      { path: 'a.ts', content: 'const a = 1;' },
      { path: 'extra.ts', content: 'const e = 3;' },
    ],
  });
  assert(r.deterministic === false, 'Should not be deterministic');
  assert(r.fileResults.some(f => f.status === 'extra'), 'Should have extra file');
});

test('16. compareOutputs: cosmetic difference within tolerance', () => {
  const r = compareOutputs({
    expected: [{ path: 'a.ts', content: 'const  a  =  1 ;' }],
    actual: [{ path: 'a.ts', content: 'const a = 1;' }],
    tolerance: 'relaxed',
  });
  // Cosmetic difference should be within relaxed tolerance
  assert(r.fileResults[0].score > 0.7, `Score should be > 0.7, got ${r.fileResults[0].score}`);
});

// ── Ledger ──

test('17. recordViolation writes to ledger', () => {
  recordViolation(testRoot, {
    taskId: 'task-1', featureSlug: 'auth', agentId: 'backend-dev',
    type: 'structural', file: 'src/users.ts', score: 0.85,
    details: 'Variable naming differs',
  });
  recordViolation(testRoot, {
    taskId: 'task-2', featureSlug: 'auth', agentId: 'frontend-dev',
    type: 'cosmetic', file: 'src/ui.tsx', score: 0.95,
    details: 'Whitespace differences',
  });
  recordViolation(testRoot, {
    taskId: 'task-3', featureSlug: 'payments', agentId: 'backend-dev',
    type: 'semantic', file: 'src/users.ts', score: 0.4,
    details: 'Different algorithm',
  });

  const entries = loadLedger(testRoot);
  assert(entries.length === 3, `Expected 3 entries, got ${entries.length}`);
});

test('18. loadLedger filters by feature', () => {
  const entries = loadLedger(testRoot, { featureSlug: 'auth' });
  assert(entries.length === 2, `Expected 2 auth entries, got ${entries.length}`);
});

test('19. loadLedger filters by type', () => {
  const entries = loadLedger(testRoot, { type: 'semantic' });
  assert(entries.length === 1, `Expected 1 semantic entry, got ${entries.length}`);
});

test('20. loadLedger filters by taskId', () => {
  const entries = loadLedger(testRoot, { taskId: 'task-1' });
  assert(entries.length === 1, `Expected 1 entry for task-1, got ${entries.length}`);
});

test('21. loadLedger with limit', () => {
  const entries = loadLedger(testRoot, { limit: 2 });
  assert(entries.length === 2, `Expected 2 entries with limit, got ${entries.length}`);
});

test('22. analyzeLedger computes stats', () => {
  const stats = analyzeLedger(testRoot);

  assert(stats.totalViolations === 3, `Expected 3 total, got ${stats.totalViolations}`);
  assert(stats.byType.structural === 1, 'Should have 1 structural');
  assert(stats.byType.cosmetic === 1, 'Should have 1 cosmetic');
  assert(stats.byType.semantic === 1, 'Should have 1 semantic');
  assert(stats.byFeature.auth === 2, 'auth should have 2');
  assert(stats.byFeature.payments === 1, 'payments should have 1');
  assert(stats.topFiles.length > 0, 'Should have top files');
  assert(stats.topFiles[0].file === 'src/users.ts', 'Top file should be users.ts (2 violations)');
  assert(stats.topFiles[0].count === 2, 'users.ts should have 2 violations');
  assert(typeof stats.recentRate === 'number', 'Should have recent rate');
});

test('23. loadLedger returns empty for nonexistent root', () => {
  const entries = loadLedger('/nonexistent/path');
  assert(entries.length === 0, 'Should return empty');
});

// ── Cleanup ──

try { rmSync(testRoot, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
