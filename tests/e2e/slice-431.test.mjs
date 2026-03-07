/**
 * Slice 431 — Artifact Context Injection
 * Tests loadDependencyArtifacts + prompt-builder section header support.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadDependencyArtifacts } from '../../tools/ogu/commands/lib/agent-executor.mjs';
import { buildPrompt } from '../../tools/ogu/commands/lib/prompt-builder.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 431: Artifact Context Injection ===\n');

// Setup temp directory
const TMP = join(process.cwd(), '.tmp-test-431');
function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/runners'), { recursive: true });
}
function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

// ── loadDependencyArtifacts ──────────────────────────────────────────────────

test('empty dependsOn returns empty array', () => {
  setup();
  const result = loadDependencyArtifacts(TMP, { dependsOn: [] }, join(TMP, '.ogu/runners'));
  assert.deepEqual(result, []);
  cleanup();
});

test('null taskSpec returns empty array', () => {
  const result = loadDependencyArtifacts(TMP, null, join(TMP, '.ogu/runners'));
  assert.deepEqual(result, []);
});

test('no dependsOn field returns empty array', () => {
  const result = loadDependencyArtifacts(TMP, {}, join(TMP, '.ogu/runners'));
  assert.deepEqual(result, []);
});

test('missing output envelope returns empty array', () => {
  setup();
  const result = loadDependencyArtifacts(TMP, { dependsOn: ['nonexistent-task'] }, join(TMP, '.ogu/runners'));
  assert.deepEqual(result, []);
  cleanup();
});

test('reads files from OutputEnvelope', () => {
  setup();
  // Create a source file
  mkdirSync(join(TMP, 'src/db'), { recursive: true });
  writeFileSync(join(TMP, 'src/db/schema.sql'), 'CREATE TABLE users (id INT);', 'utf8');

  // Create output envelope
  writeFileSync(
    join(TMP, '.ogu/runners/dep-task.output.json'),
    JSON.stringify({ files: [{ path: 'src/db/schema.sql', action: 'created' }] }),
    'utf8',
  );

  const result = loadDependencyArtifacts(
    TMP,
    { dependsOn: ['dep-task'] },
    join(TMP, '.ogu/runners'),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].path, 'src/db/schema.sql');
  assert.ok(result[0].content.includes('CREATE TABLE'));
  assert.equal(result[0]._isDepArtifact, true);
  cleanup();
});

test('caps at 15k chars per file', () => {
  setup();
  mkdirSync(join(TMP, 'src'), { recursive: true });
  writeFileSync(join(TMP, 'src/big.ts'), 'x'.repeat(20000), 'utf8');
  writeFileSync(
    join(TMP, '.ogu/runners/big-dep.output.json'),
    JSON.stringify({ files: [{ path: 'src/big.ts' }] }),
    'utf8',
  );

  const result = loadDependencyArtifacts(
    TMP,
    { dependsOn: ['big-dep'] },
    join(TMP, '.ogu/runners'),
  );
  assert.equal(result.length, 1);
  assert.ok(result[0].content.length <= 15100); // 15k + [truncated]
  assert.ok(result[0].content.includes('[truncated]'));
  cleanup();
});

test('total cap at 50k across multiple deps', () => {
  setup();
  mkdirSync(join(TMP, 'src'), { recursive: true });
  // Create 5 files of 15k each = 75k total, should cap at 50k
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(TMP, `src/f${i}.ts`), 'y'.repeat(14000), 'utf8');
    writeFileSync(
      join(TMP, `.ogu/runners/dep-${i}.output.json`),
      JSON.stringify({ files: [{ path: `src/f${i}.ts` }] }),
      'utf8',
    );
  }

  const result = loadDependencyArtifacts(
    TMP,
    { dependsOn: ['dep-0', 'dep-1', 'dep-2', 'dep-3', 'dep-4'] },
    join(TMP, '.ogu/runners'),
  );
  const totalChars = result.reduce((s, r) => s + r.content.length, 0);
  assert.ok(totalChars <= 50100, `Total ${totalChars} exceeds 50k cap`);
  // Should get 3 full files (42k) + partial 4th
  assert.ok(result.length >= 3, `Expected >=3 artifacts, got ${result.length}`);
  cleanup();
});

test('skips non-existent files gracefully', () => {
  setup();
  writeFileSync(
    join(TMP, '.ogu/runners/ghost-dep.output.json'),
    JSON.stringify({ files: [{ path: 'src/nonexistent.ts' }, { path: 'src/also-missing.ts' }] }),
    'utf8',
  );

  const result = loadDependencyArtifacts(
    TMP,
    { dependsOn: ['ghost-dep'] },
    join(TMP, '.ogu/runners'),
  );
  assert.deepEqual(result, []);
  cleanup();
});

test('falls back to input_artifacts when no output envelope', () => {
  setup();
  mkdirSync(join(TMP, 'src'), { recursive: true });
  writeFileSync(join(TMP, 'src/fallback.ts'), 'export const x = 1;', 'utf8');

  const result = loadDependencyArtifacts(
    TMP,
    {
      dependsOn: ['missing-envelope-dep'],
      input_artifacts: ['src/fallback.ts'],
    },
    join(TMP, '.ogu/runners'),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].path, 'src/fallback.ts');
  cleanup();
});

// ── prompt-builder _sectionHeader support ────────────────────────────────────

test('buildPrompt renders _sectionHeader for dep artifacts', () => {
  const result = buildPrompt({
    role: 'backend_engineer',
    taskName: 'Build API',
    taskDescription: 'Implement endpoints',
    featureSlug: 'test-feat',
    contextFiles: [
      { path: 'src/types.ts', content: 'export type A = string;' },
      { path: 'src/db/schema.sql', content: 'CREATE TABLE x;', _isDepArtifact: true, _sectionHeader: '## Dependency Artifacts' },
      { path: 'src/db/seed.sql', content: 'INSERT INTO x;', _isDepArtifact: true },
    ],
  });

  const content = result.messages[0].content;
  assert.ok(content.includes('## Context:'), 'Should have Context section');
  assert.ok(content.includes('## Dependency Artifacts'), 'Should have Dependency Artifacts section');
  // Context section should appear before Dependency Artifacts
  const ctxIdx = content.indexOf('## Context:');
  const depIdx = content.indexOf('## Dependency Artifacts');
  assert.ok(ctxIdx < depIdx, 'Context should come before Dependency Artifacts');
});

test('buildPrompt without _sectionHeader renders normal Context only', () => {
  const result = buildPrompt({
    role: 'qa',
    taskName: 'Test',
    taskDescription: 'Test it',
    featureSlug: 'f1',
    contextFiles: [
      { path: 'a.ts', content: 'code' },
      { path: 'b.ts', content: 'more code' },
    ],
  });

  const content = result.messages[0].content;
  assert.ok(content.includes('## Context:'));
  assert.ok(!content.includes('## Dependency Artifacts'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
cleanup();
process.exit(failed > 0 ? 1 : 0);
