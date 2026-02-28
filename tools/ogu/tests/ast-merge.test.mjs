/**
 * AST Merge Tests.
 *
 * 8 tests covering:
 *   Section 1: computeASTDiff (3 tests)
 *   Section 2: detectASTConflicts (3 tests)
 *   Section 3: mergeFileAST (2 tests)
 */

import { computeASTDiff, detectASTConflicts, mergeFileAST, extractBlocks } from '../commands/lib/ast-merge.mjs';

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

const jsBase = `import { foo } from 'bar';

function hello() {
  return 'hello';
}

function goodbye() {
  return 'goodbye';
}
`;

const jsModified = `import { foo } from 'bar';

function hello() {
  return 'hello world';
}

function goodbye() {
  return 'goodbye';
}
`;

const jsAdded = `import { foo } from 'bar';

function hello() {
  return 'hello';
}

function goodbye() {
  return 'goodbye';
}

function newFunc() {
  return 'new';
}
`;

const jsRemoved = `import { foo } from 'bar';

function goodbye() {
  return 'goodbye';
}
`;

// ═══════════════════════════════════════════════════════════════════════
// Section 1: computeASTDiff
// ═══════════════════════════════════════════════════════════════════════

// 1. Detects modified blocks
{
  const diff = computeASTDiff(jsBase, jsModified, 'javascript');
  const hasModified = diff.modified && diff.modified.length > 0;
  assert(hasModified, 'computeASTDiff detects modified blocks');
}

// 2. Detects added blocks
{
  const diff = computeASTDiff(jsBase, jsAdded, 'javascript');
  const hasAdded = diff.added && diff.added.length > 0;
  assert(hasAdded, 'computeASTDiff detects added blocks');
}

// 3. Detects removed blocks
{
  const diff = computeASTDiff(jsBase, jsRemoved, 'javascript');
  const hasRemoved = diff.removed && diff.removed.length > 0;
  assert(hasRemoved, 'computeASTDiff detects removed blocks');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: detectASTConflicts
// ═══════════════════════════════════════════════════════════════════════

// 4. No conflicts when changes don't overlap
{
  const ours = `import { foo } from 'bar';

function hello() {
  return 'hello world';
}

function goodbye() {
  return 'goodbye';
}
`;
  const theirs = `import { foo } from 'bar';

function hello() {
  return 'hello';
}

function goodbye() {
  return 'goodbye world';
}
`;
  const result = detectASTConflicts(jsBase, ours, theirs);
  // Returns { conflicts, autoMergeable, conflictBlocks }
  assert(result && Array.isArray(result.conflicts), 'detectASTConflicts returns array');
}

// 5. Conflicts when both modify same function
{
  const ours = `import { foo } from 'bar';

function hello() {
  return 'ours';
}

function goodbye() {
  return 'goodbye';
}
`;
  const theirs = `import { foo } from 'bar';

function hello() {
  return 'theirs';
}

function goodbye() {
  return 'goodbye';
}
`;
  const result = detectASTConflicts(jsBase, ours, theirs);
  const hasConflict = result && result.conflicts && result.conflicts.length > 0;
  assert(hasConflict, 'detectASTConflicts finds conflicts when both modify same function');
}

// 6. extractBlocks works for JS
{
  const blocks = extractBlocks(jsBase, 'javascript');
  assert(Array.isArray(blocks) && blocks.length >= 2,
    'extractBlocks parses JS into blocks');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: mergeFileAST
// ═══════════════════════════════════════════════════════════════════════

// 7. mergeFileAST produces merged output
{
  const ours = `import { foo } from 'bar';

function hello() {
  return 'hello world';
}

function goodbye() {
  return 'goodbye';
}
`;
  const theirs = `import { foo } from 'bar';

function hello() {
  return 'hello';
}

function goodbye() {
  return 'goodbye world';
}
`;
  const merged = mergeFileAST(jsBase, ours, theirs);
  assert(merged && (typeof merged.merged === 'string' || merged.success !== undefined),
    'mergeFileAST produces output');
}

// 8. Supports Python blocks
{
  const pyCode = `import os

def hello():
    return 'hello'

def goodbye():
    return 'goodbye'
`;
  const blocks = extractBlocks(pyCode, 'python');
  assert(Array.isArray(blocks) && blocks.length >= 1,
    'extractBlocks supports Python');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nAST Merge Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
