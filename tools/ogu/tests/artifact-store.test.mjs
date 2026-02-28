/**
 * Artifact Store Tests — full lifecycle: store, load, resolve, verify, dependencies.
 *
 * Run: node tools/ogu/tests/artifact-store.test.mjs
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

const {
  storeArtifact,
  loadArtifact,
  loadArtifacts,
  resolveArtifact,
  verifyArtifact,
  verifyArtifactFiles,
  checkDependencies,
  checkAllDependencies,
  listArtifacts,
  getArtifactIndex,
  ARTIFACT_TYPES,
} = await import('../commands/lib/artifact-store.mjs');

// ── Setup: temp directory as fake root ──

const testRoot = join(tmpdir(), `ogu-artifact-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/artifacts'), { recursive: true });

console.log('\nArtifact Store Tests\n');

// ── storeArtifact ──

test('1. storeArtifact creates artifact with full schema', () => {
  const artifact = storeArtifact('task-1', 'auth', {
    type: 'SCHEMA',
    identifier: 'SCHEMA:users',
    files: [{ path: 'src/models/users.ts', content: 'export interface User {}' }],
    dependencies: [],
    agentId: 'backend-dev',
    metadata: { roleId: 'backend-dev', model: 'claude-haiku', tier: 'fast' },
  }, testRoot);

  assert(artifact.id, 'Should have UUID id');
  assert(artifact.type === 'SCHEMA', `Type should be SCHEMA, got ${artifact.type}`);
  assert(artifact.identifier === 'SCHEMA:users', 'Identifier should match');
  assert(artifact.producedBy.agentId === 'backend-dev', 'Agent should match');
  assert(artifact.producedBy.taskId === 'task-1', 'TaskId should match');
  assert(artifact.producedBy.featureSlug === 'auth', 'Feature should match');
  assert(artifact.files.length === 1, 'Should have 1 file');
  assert(artifact.files[0].hash, 'File should have hash');
  assert(artifact.verified === false, 'Should not be verified yet');
  assert(artifact.producedAt, 'Should have timestamp');
});

test('2. storeArtifact defaults type to FILE', () => {
  const artifact = storeArtifact('task-2', 'auth', {
    files: [{ path: 'src/api/users.ts' }],
  }, testRoot);

  assert(artifact.type === 'FILE', `Default type should be FILE, got ${artifact.type}`);
  assert(artifact.identifier === 'FILE:task-2', 'Default identifier should be FILE:taskId');
});

test('3. storeArtifact with dependencies', () => {
  const artifact = storeArtifact('task-3', 'auth', {
    type: 'API',
    identifier: 'API:/users POST',
    files: [{ path: 'src/api/users/route.ts', content: 'export async function POST() {}' }],
    dependencies: ['SCHEMA:users'],
    agentId: 'backend-dev',
  }, testRoot);

  assert(artifact.dependencies.length === 1, 'Should have 1 dependency');
  assert(artifact.dependencies[0] === 'SCHEMA:users', 'Dependency should match');
});

// ── loadArtifact ──

test('4. loadArtifact returns stored artifact', () => {
  const artifact = loadArtifact('task-1', 'auth', testRoot);
  assert(artifact !== null, 'Should find artifact');
  assert(artifact.type === 'SCHEMA', 'Type should match');
  assert(artifact.identifier === 'SCHEMA:users', 'Identifier should match');
});

test('5. loadArtifact returns null for missing', () => {
  const artifact = loadArtifact('nonexistent', 'auth', testRoot);
  assert(artifact === null, 'Should return null');
});

test('6. loadArtifacts is backward-compatible alias', () => {
  const artifact = loadArtifacts('task-1', 'auth', testRoot);
  assert(artifact !== null, 'Alias should work');
  assert(artifact.identifier === 'SCHEMA:users', 'Should return same data');
});

// ── getArtifactIndex ──

test('7. getArtifactIndex returns feature index', () => {
  const index = getArtifactIndex('auth', testRoot);
  assert(index !== null, 'Index should exist');
  assert(index.artifacts, 'Should have artifacts map');
  assert(index.artifacts['SCHEMA:users'], 'Should have SCHEMA:users');
  assert(index.artifacts['FILE:task-2'], 'Should have FILE:task-2');
  assert(index.artifacts['API:/users POST'], 'Should have API:/users POST');
  assert(index.updatedAt, 'Should have updatedAt');
});

test('8. getArtifactIndex returns null for missing feature', () => {
  const index = getArtifactIndex('nonexistent', testRoot);
  assert(index === null, 'Should return null');
});

// ── resolveArtifact ──

test('9. resolveArtifact finds by identifier', () => {
  const artifact = resolveArtifact('auth', 'SCHEMA:users', testRoot);
  assert(artifact !== null, 'Should resolve');
  assert(artifact.producedBy.taskId === 'task-1', 'Should point to task-1');
});

test('10. resolveArtifact returns null for unknown identifier', () => {
  const artifact = resolveArtifact('auth', 'SCHEMA:nonexistent', testRoot);
  assert(artifact === null, 'Should return null');
});

// ── verifyArtifact ──

test('11. verifyArtifact marks artifact as verified', () => {
  const result = verifyArtifact('task-1', 'auth', 'gate:typecheck', testRoot);
  assert(result.verified === true, 'Should verify');

  const artifact = loadArtifact('task-1', 'auth', testRoot);
  assert(artifact.verified === true, 'Stored artifact should be verified');
  assert(artifact.verifiedBy === 'gate:typecheck', 'VerifiedBy should match');
  assert(artifact.verifiedAt, 'Should have verifiedAt');
});

test('12. verifyArtifact updates index', () => {
  const index = getArtifactIndex('auth', testRoot);
  assert(index.artifacts['SCHEMA:users'].verified === true, 'Index should show verified');
  assert(index.artifacts['SCHEMA:users'].verifiedBy === 'gate:typecheck', 'Index verifiedBy should match');
});

test('13. verifyArtifact returns error for missing', () => {
  const result = verifyArtifact('nonexistent', 'auth', 'gate:test', testRoot);
  assert(result.verified === false, 'Should not verify');
  assert(result.error === 'Artifact not found', 'Should have error');
});

// ── checkDependencies ──

test('14. checkDependencies reports ready when deps verified', () => {
  // task-3 depends on SCHEMA:users (task-1) which is now verified
  const result = checkDependencies('task-3', 'auth', testRoot);
  assert(result.ready === true, `Should be ready, got missing: ${result.missing}, unverified: ${result.unverified}`);
  assert(result.missing.length === 0, 'No missing');
  assert(result.unverified.length === 0, 'No unverified');
});

test('15. checkDependencies detects unverified deps', () => {
  // Store a new artifact with dep on unverified FILE:task-2
  storeArtifact('task-4', 'auth', {
    type: 'TEST',
    identifier: 'TEST:users-api',
    dependencies: ['FILE:task-2'],
  }, testRoot);

  const result = checkDependencies('task-4', 'auth', testRoot);
  assert(result.ready === false, 'Should not be ready');
  assert(result.unverified.includes('FILE:task-2'), 'Should show task-2 as unverified');
});

test('16. checkDependencies detects missing deps', () => {
  storeArtifact('task-5', 'auth', {
    type: 'FILE',
    identifier: 'FILE:task-5',
    dependencies: ['SCHEMA:nonexistent'],
  }, testRoot);

  const result = checkDependencies('task-5', 'auth', testRoot);
  assert(result.ready === false, 'Should not be ready');
  assert(result.missing.includes('SCHEMA:nonexistent'), 'Should show missing dep');
});

// ── checkAllDependencies ──

test('17. checkAllDependencies checks full task set', () => {
  const tasks = [
    { id: 'task-1', dependsOn: [] },
    { id: 'task-3', dependsOn: ['task-1'] },
    { id: 'task-4', dependsOn: ['task-2'] },
  ];

  const result = checkAllDependencies('auth', tasks, testRoot);
  // task-1 has artifact and is verified
  // task-3 depends on task-1 which is verified → ready
  // task-4 depends on task-2 which exists but is unverified → blocked
  assert(result.ready === false, 'Should not be all ready');
  assert(result.blocked.length === 1, `Should have 1 blocked, got ${result.blocked.length}`);
  assert(result.blocked[0].taskId === 'task-4', 'task-4 should be blocked');
  assert(result.blocked[0].unverified.includes('task-2'), 'task-2 should be unverified');
});

// ── verifyArtifactFiles ──

test('18. verifyArtifactFiles checks files on disk', () => {
  // Create the file on disk that task-1 references
  const filePath = join(testRoot, 'src/models/users.ts');
  mkdirSync(join(testRoot, 'src/models'), { recursive: true });
  writeFileSync(filePath, 'export interface User {}', 'utf8');

  const result = verifyArtifactFiles('task-1', 'auth', testRoot);
  assert(result.valid === true, `Should be valid, got errors: ${result.errors.join(', ')}`);
});

test('19. verifyArtifactFiles detects missing files', () => {
  // task-2 references src/api/users.ts which doesn't exist
  const result = verifyArtifactFiles('task-2', 'auth', testRoot);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('not found')), 'Should report missing file');
});

test('20. verifyArtifactFiles detects hash mismatch', () => {
  // Modify the file to cause hash mismatch
  const filePath = join(testRoot, 'src/models/users.ts');
  writeFileSync(filePath, 'export interface User { id: number }', 'utf8');

  const result = verifyArtifactFiles('task-1', 'auth', testRoot);
  assert(result.valid === false, 'Should be invalid after modification');
  assert(result.errors.some(e => e.includes('Hash mismatch')), 'Should report hash mismatch');
});

// ── listArtifacts ──

test('21. listArtifacts returns all task IDs', () => {
  const list = listArtifacts('auth', testRoot);
  assert(list.includes('task-1'), 'Should include task-1');
  assert(list.includes('task-2'), 'Should include task-2');
  assert(list.includes('task-3'), 'Should include task-3');
  assert(list.length >= 5, `Should have at least 5 artifacts, got ${list.length}`);
});

test('22. listArtifacts returns empty for unknown feature', () => {
  const list = listArtifacts('nonexistent', testRoot);
  assert(list.length === 0, 'Should be empty');
});

// ── ARTIFACT_TYPES ──

test('23. ARTIFACT_TYPES contains all expected types', () => {
  assert(ARTIFACT_TYPES.includes('FILE'), 'Should have FILE');
  assert(ARTIFACT_TYPES.includes('API'), 'Should have API');
  assert(ARTIFACT_TYPES.includes('SCHEMA'), 'Should have SCHEMA');
  assert(ARTIFACT_TYPES.includes('COMPONENT'), 'Should have COMPONENT');
  assert(ARTIFACT_TYPES.includes('TEST'), 'Should have TEST');
  assert(ARTIFACT_TYPES.length === 8, `Should have 8 types, got ${ARTIFACT_TYPES.length}`);
});

// ── Cleanup ──

try { rmSync(testRoot, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
