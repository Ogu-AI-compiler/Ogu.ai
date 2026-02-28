/**
 * Worktree Manager Tests — real git worktree operations.
 *
 * Creates a temporary git repo for isolated testing.
 *
 * Run: node tools/ogu/tests/worktree-manager.test.mjs
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';

let passed = 0;
let failed = 0;

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Setup: create a temporary git repo ──

const testRoot = join(tmpdir(), `ogu-wt-test-${randomUUID().slice(0, 8)}`);
mkdirSync(testRoot, { recursive: true });
execSync('git init', { cwd: testRoot, stdio: 'pipe' });
execSync('git config user.email "test@ogu.dev"', { cwd: testRoot, stdio: 'pipe' });
execSync('git config user.name "Ogu Test"', { cwd: testRoot, stdio: 'pipe' });
writeFileSync(join(testRoot, 'README.md'), '# Test Repo\n', 'utf8');
execSync('git add -A && git commit -m "init"', { cwd: testRoot, stdio: 'pipe' });

// Import after setup so module-level code doesn't fail
const {
  createWorktree,
  removeWorktree,
  mergeWorktree,
  validateWorktree,
  listWorktrees,
  listAgentWorktrees,
  pruneWorktrees,
  getWorktreeInfo,
  parsePorcelainWorktreeList,
} = await import('../commands/lib/worktree-manager.mjs');

const { createWorktreeCreator } = await import('../commands/lib/worktree-creator.mjs');

console.log('\nWorktree Manager Tests\n');

// ── createWorktree ──

await asyncTest('1. createWorktree creates a real git worktree', async () => {
  const result = createWorktree(testRoot, {
    featureSlug: 'auth',
    taskId: 'task-1',
  });

  assert(result.path.includes('.claude/worktrees/auth-task-1'), `Path should include worktree name, got: ${result.path}`);
  assert(result.branch === 'agent/auth/task-1', `Branch should be agent/auth/task-1, got: ${result.branch}`);
  assert(existsSync(result.path), 'Worktree directory should exist');
  assert(existsSync(join(result.path, 'README.md')), 'Worktree should contain repo files');

  // Verify git sees the worktree
  const gitList = execSync('git worktree list', { cwd: testRoot, stdio: 'pipe' }).toString();
  assert(gitList.includes('auth-task-1'), 'git worktree list should show the worktree');
});

await asyncTest('2. createWorktree with roleId includes it in path', async () => {
  const result = createWorktree(testRoot, {
    featureSlug: 'auth',
    taskId: 'task-2',
    roleId: 'backend-dev',
  });

  assert(result.name === 'auth-task-2-backend-dev', `Name should include roleId, got: ${result.name}`);
  assert(existsSync(result.path), 'Worktree should exist');
});

await asyncTest('3. createWorktree dry-run returns command without executing', async () => {
  const result = createWorktree(testRoot, {
    featureSlug: 'auth',
    taskId: 'task-dry',
    dryRun: true,
  });

  assert(result.dryRun === true, 'Should be dry-run');
  assert(result.cmd.includes('git worktree add'), 'Should include git command');
  assert(!existsSync(result.path), 'Worktree should NOT exist in dry-run');
});

await asyncTest('4. createWorktree returns existing if path exists', async () => {
  // Task-1 worktree already exists from test 1
  const result = createWorktree(testRoot, {
    featureSlug: 'auth',
    taskId: 'task-1',
  });

  assert(result.existed === true, 'Should indicate existing worktree');
});

// ── listWorktrees ──

await asyncTest('5. listWorktrees returns all worktrees', async () => {
  const list = listWorktrees(testRoot);
  assert(list.length >= 3, `Expected at least 3 worktrees (main + 2 created), got ${list.length}`);

  const agentList = listAgentWorktrees(testRoot);
  assert(agentList.length === 2, `Expected 2 agent worktrees, got ${agentList.length}`);
});

// ── validateWorktree ──

await asyncTest('6. validateWorktree reports clean worktree', async () => {
  const worktreePath = join(testRoot, '.claude/worktrees/auth-task-1');
  const result = validateWorktree(worktreePath);
  assert(result.valid === true, 'Should be valid');
  assert(result.clean === true, 'Should be clean (no changes)');
  assert(result.uncommitted === 0, 'Should have 0 uncommitted files');
});

await asyncTest('7. validateWorktree detects dirty worktree', async () => {
  const worktreePath = join(testRoot, '.claude/worktrees/auth-task-1');
  writeFileSync(join(worktreePath, 'new-file.txt'), 'test content\n', 'utf8');

  const result = validateWorktree(worktreePath);
  assert(result.valid === true, 'Should still be valid');
  assert(result.clean === false, 'Should be dirty');
  assert(result.uncommitted > 0, 'Should have uncommitted files');
});

await asyncTest('8. validateWorktree handles missing path', async () => {
  const result = validateWorktree('/nonexistent/path');
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
});

// ── mergeWorktree ──

await asyncTest('9. mergeWorktree merges changes and cleans up', async () => {
  const worktreePath = join(testRoot, '.claude/worktrees/auth-task-1');

  // Commit the file we added in test 7
  execSync('git add -A && git commit -m "add new-file"', { cwd: worktreePath, stdio: 'pipe' });

  const result = mergeWorktree(testRoot, {
    worktreePath,
    branch: 'agent/auth/task-1',
    featureSlug: 'auth',
    taskId: 'task-1',
  });

  assert(result.merged === true, `Should be merged, got: ${JSON.stringify(result)}`);
  // Worktree should be removed
  assert(!existsSync(worktreePath), 'Worktree directory should be removed');
  // File should be in main repo
  assert(existsSync(join(testRoot, 'new-file.txt')), 'Merged file should exist in main repo');
});

await asyncTest('10. mergeWorktree dry-run returns commands', async () => {
  const result = mergeWorktree(testRoot, {
    worktreePath: '/fake/path',
    branch: 'agent/test/dry',
    featureSlug: 'test',
    taskId: 'dry',
    dryRun: true,
  });

  assert(result.dryRun === true, 'Should be dry-run');
  assert(result.cmds.length >= 2, 'Should have at least 2 commands');
});

// ── removeWorktree ──

await asyncTest('11. removeWorktree removes an existing worktree', async () => {
  const worktreePath = join(testRoot, '.claude/worktrees/auth-task-2-backend-dev');
  assert(existsSync(worktreePath), 'Worktree should exist before removal');

  const result = removeWorktree(testRoot, { worktreePath });
  assert(result.removed === true, 'Should be removed');
  assert(!existsSync(worktreePath), 'Worktree directory should be gone');
});

await asyncTest('12. removeWorktree handles missing path', async () => {
  const result = removeWorktree(testRoot, { worktreePath: '/nonexistent/path' });
  assert(result.removed === false, 'Should report not removed');
  assert(result.reason === 'not_found', 'Should give not_found reason');
});

// ── pruneWorktrees ──

await asyncTest('13. pruneWorktrees runs without error', async () => {
  const result = pruneWorktrees(testRoot);
  assert(result.pruned === true, 'Should report pruned');
});

await asyncTest('14. pruneWorktrees dry-run shows what would be pruned', async () => {
  const result = pruneWorktrees(testRoot, true);
  assert(result.dryRun === true, 'Should be dry-run');
});

// ── parsePorcelainWorktreeList ──

await asyncTest('15. parsePorcelainWorktreeList parses correctly', async () => {
  const input = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/feature
HEAD 789abc012
branch refs/heads/agent/auth/task-1

`;

  const result = parsePorcelainWorktreeList(input);
  assert(result.length === 2, `Expected 2 worktrees, got ${result.length}`);
  assert(result[0].path === '/path/to/main', 'First path should match');
  assert(result[0].branch === 'main', 'Should strip refs/heads/');
  assert(result[1].branch === 'agent/auth/task-1', 'Should parse agent branch');
  assert(result[1].head === '789abc012', 'Should parse HEAD');
});

// ── getWorktreeInfo ──

await asyncTest('16. getWorktreeInfo returns info for existing worktree', async () => {
  const info = getWorktreeInfo(testRoot, testRoot);
  assert(info !== null, 'Should find main worktree');
  // Compare using realpath to handle macOS /tmp → /private/tmp symlink
  const realTestRoot = realpathSync(testRoot);
  let realInfoPath;
  try { realInfoPath = realpathSync(info.path); } catch { realInfoPath = info.path; }
  assert(realInfoPath === realTestRoot, `Path should match: ${realInfoPath} vs ${realTestRoot}`);
});

// ── createWorktreeCreator ──

await asyncTest('17. createWorktreeCreator create+list+remove cycle', async () => {
  const creator = createWorktreeCreator({ repoRoot: testRoot });

  // Plan
  const plan = creator.plan({ agentId: 'dev', taskId: 'wc-1', feature: 'test' });
  assert(plan.branch === 'agent/test/dev/wc-1', 'Branch should match');

  // Create
  const entry = await creator.create({ agentId: 'dev', taskId: 'wc-1', feature: 'test' });
  assert(entry.branch === 'agent/test/dev/wc-1', 'Created branch should match');
  assert(existsSync(entry.path), 'Created worktree should exist');

  // List
  const list = creator.list();
  assert(list.length === 1, 'Should track 1 worktree');

  // Get
  const got = creator.get('agent/test/dev/wc-1');
  assert(got !== null, 'Should find by branch');
  assert(got.taskId === 'wc-1', 'TaskId should match');

  // Validate
  const validation = creator.validate('agent/test/dev/wc-1');
  assert(validation.valid === true, 'Should be valid');

  // Remove
  creator.remove('agent/test/dev/wc-1');
  const afterRemove = creator.list();
  assert(afterRemove.length === 0, 'Should have 0 after remove');
});

// ── Cleanup ──

try {
  execSync('git worktree prune', { cwd: testRoot, stdio: 'pipe' });
  rmSync(testRoot, { recursive: true, force: true });
} catch { /* best effort cleanup */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
