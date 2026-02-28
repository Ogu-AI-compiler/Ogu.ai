/**
 * DAG Builder Tests — buildDAG, parseDeps (Kahn's algorithm, wave computation, cycle detection).
 *
 * Run: node tools/ogu/tests/dag-builder.test.mjs
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const { buildDAG, parseDeps } = await import('../commands/lib/dag-builder.mjs');

console.log('\nDAG Builder Tests\n');

// ── buildDAG basic ──

test('1. buildDAG handles single task (no deps)', () => {
  const result = buildDAG([{ taskId: 'A', blockedBy: [] }]);
  assert(result.valid === true, 'should be valid');
  assert(result.taskCount === 1, `taskCount should be 1, got ${result.taskCount}`);
  assert(result.waves.length === 1, `should have 1 wave, got ${result.waves.length}`);
  assert(result.waves[0].includes('A'), 'wave 0 should contain A');
});

test('2. buildDAG handles linear chain A→B→C', () => {
  const tasks = [
    { taskId: 'A', blockedBy: [] },
    { taskId: 'B', blockedBy: ['A'] },
    { taskId: 'C', blockedBy: ['B'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.waves.length === 3, `should have 3 waves, got ${result.waves.length}`);
  assert(result.waves[0].includes('A'), 'wave 0 = A');
  assert(result.waves[1].includes('B'), 'wave 1 = B');
  assert(result.waves[2].includes('C'), 'wave 2 = C');
});

test('3. buildDAG handles parallel tasks (no deps)', () => {
  const tasks = [
    { taskId: 'A', blockedBy: [] },
    { taskId: 'B', blockedBy: [] },
    { taskId: 'C', blockedBy: [] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.waves.length === 1, `should have 1 wave, got ${result.waves.length}`);
  assert(result.waves[0].length === 3, `wave 0 should have 3 tasks, got ${result.waves[0].length}`);
});

test('4. buildDAG handles diamond: A→{B,C}→D', () => {
  const tasks = [
    { taskId: 'A', blockedBy: [] },
    { taskId: 'B', blockedBy: ['A'] },
    { taskId: 'C', blockedBy: ['A'] },
    { taskId: 'D', blockedBy: ['B', 'C'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.waves.length === 3, `should have 3 waves, got ${result.waves.length}`);
  assert(result.waves[0].includes('A'), 'wave 0 = A');
  assert(result.waves[1].includes('B') && result.waves[1].includes('C'), 'wave 1 = B,C');
  assert(result.waves[2].includes('D'), 'wave 2 = D');
});

test('5. buildDAG detects simple cycle', () => {
  const tasks = [
    { taskId: 'A', blockedBy: ['B'] },
    { taskId: 'B', blockedBy: ['A'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === false, 'should detect cycle');
  assert(result.error && result.error.toLowerCase().includes('cycle'), `error should mention cycle: ${result.error}`);
});

test('6. buildDAG detects 3-node cycle', () => {
  const tasks = [
    { taskId: 'A', blockedBy: ['C'] },
    { taskId: 'B', blockedBy: ['A'] },
    { taskId: 'C', blockedBy: ['B'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === false, 'should detect cycle');
});

test('7. buildDAG detects invalid dependency reference', () => {
  const tasks = [
    { taskId: 'A', blockedBy: ['NONEXISTENT'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === false, 'should detect invalid ref');
});

test('8. buildDAG handles empty task list', () => {
  const result = buildDAG([]);
  assert(result.valid === true, 'empty should be valid');
  assert(result.taskCount === 0, 'taskCount should be 0');
  assert(result.waves.length === 0, 'should have 0 waves');
});

test('9. buildDAG handles wide DAG (many roots, shared leaf)', () => {
  const tasks = [
    { taskId: 'R1', blockedBy: [] },
    { taskId: 'R2', blockedBy: [] },
    { taskId: 'R3', blockedBy: [] },
    { taskId: 'R4', blockedBy: [] },
    { taskId: 'LEAF', blockedBy: ['R1', 'R2', 'R3', 'R4'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.waves.length === 2, `should have 2 waves, got ${result.waves.length}`);
  assert(result.waves[0].length === 4, `wave 0 should have 4 roots`);
});

test('10. buildDAG preserves task count', () => {
  const tasks = Array.from({ length: 10 }, (_, i) => ({
    taskId: `T${i}`,
    blockedBy: i === 0 ? [] : [`T${i - 1}`],
  }));
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.taskCount === 10, `should count 10 tasks, got ${result.taskCount}`);
  assert(result.waves.length === 10, 'linear chain = 10 waves');
});

// ── parseDeps ──

test('11. parseDeps handles single dep', () => {
  const result = parseDeps('B:A');
  assert(result instanceof Map, 'should return Map');
  assert(result.has('B'), 'should have B');
  const deps = result.get('B');
  assert(deps.length === 1, `should have 1 dep, got ${deps.length}`);
  assert(deps[0] === 'A', `dep should be A, got ${deps[0]}`);
});

test('12. parseDeps handles multiple deps with +', () => {
  const result = parseDeps('C:A+B');
  const deps = result.get('C');
  assert(deps.length === 2, `should have 2 deps, got ${deps.length}`);
  assert(deps.includes('A') && deps.includes('B'), 'should include A and B');
});

test('13. parseDeps handles multiple tasks with comma', () => {
  const result = parseDeps('B:A,C:A+B');
  assert(result.has('B'), 'should have B');
  assert(result.has('C'), 'should have C');
  assert(result.get('B')[0] === 'A', 'B depends on A');
  assert(result.get('C').length === 2, 'C depends on A and B');
});

test('14. parseDeps handles empty/falsy input', () => {
  const r1 = parseDeps('');
  const r2 = parseDeps(null);
  const r3 = parseDeps(undefined);
  assert(r1 instanceof Map, 'empty string returns Map');
  assert(r1.size === 0, 'empty string returns empty Map');
  assert(r2 instanceof Map, 'null returns Map');
  assert(r3 instanceof Map, 'undefined returns Map');
});

test('15. parseDeps ignores malformed entry without deps', () => {
  // parseDeps('A:') splits to ['A', ''] — the empty dep part produces no valid entry
  const result = parseDeps('A:');
  // Implementation may or may not include 'A' — just shouldn't crash
  assert(result instanceof Map, 'should return Map');
});

// ── Complex DAG patterns ──

test('16. buildDAG handles multi-root merge', () => {
  const tasks = [
    { taskId: 'setup-db', blockedBy: [] },
    { taskId: 'setup-auth', blockedBy: [] },
    { taskId: 'setup-api', blockedBy: [] },
    { taskId: 'build-users', blockedBy: ['setup-db', 'setup-auth'] },
    { taskId: 'build-posts', blockedBy: ['setup-db', 'setup-api'] },
    { taskId: 'integration', blockedBy: ['build-users', 'build-posts'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should be valid');
  assert(result.taskCount === 6, 'should count 6 tasks');
  assert(result.waves.length === 3, `should have 3 waves, got ${result.waves.length}`);
});

test('17. buildDAG handles self-dependency as cycle', () => {
  const tasks = [
    { taskId: 'A', blockedBy: ['A'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === false, 'self-dep should be invalid');
});

test('18. buildDAG handles duplicate task IDs', () => {
  const tasks = [
    { taskId: 'A', blockedBy: [] },
    { taskId: 'A', blockedBy: [] },
  ];
  const result = buildDAG(tasks);
  // Either valid with dedup or invalid — just shouldn't crash
  assert(typeof result.valid === 'boolean', 'should return valid boolean');
});

test('19. buildDAG handles deeply nested chain (20 levels)', () => {
  const tasks = Array.from({ length: 20 }, (_, i) => ({
    taskId: `task-${i}`,
    blockedBy: i === 0 ? [] : [`task-${i - 1}`],
  }));
  const result = buildDAG(tasks);
  assert(result.valid === true, 'should handle deep chains');
  assert(result.waves.length === 20, 'should produce 20 waves');
});

test('20. buildDAG handles partial cycle (some tasks valid, some cycled)', () => {
  const tasks = [
    { taskId: 'A', blockedBy: [] },
    { taskId: 'B', blockedBy: ['A'] },
    { taskId: 'X', blockedBy: ['Y'] },
    { taskId: 'Y', blockedBy: ['X'] },
  ];
  const result = buildDAG(tasks);
  assert(result.valid === false, 'partial cycle should be invalid');
});

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
