/**
 * Worktree Manager — git worktree lifecycle per agent task.
 *
 * Real git worktree operations for agent isolation:
 *   createWorktree   — git worktree add -b <branch> <path> HEAD
 *   removeWorktree   — git worktree remove <path>
 *   mergeWorktree    — git merge --no-ff <branch>, then cleanup
 *   validateWorktree — run basic checks in worktree
 *   listWorktrees    — git worktree list --porcelain (parsed)
 *   pruneWorktrees   — git worktree prune
 *   getWorktreeInfo  — single worktree info by path
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';

const WORKTREE_BASE = '.claude/worktrees';

/**
 * Create an isolated git worktree for a task.
 *
 * @param {string} root — repo root
 * @param {object} opts
 * @param {string} opts.featureSlug — feature slug
 * @param {string} opts.taskId — task ID
 * @param {string} [opts.roleId] — optional role suffix for branch name
 * @param {string} [opts.baseBranch='HEAD'] — base ref for the worktree
 * @param {boolean} [opts.dryRun=false] — log command without executing
 * @returns {{ path: string, branch: string, name: string, dryRun: boolean }}
 */
export function createWorktree(root, { featureSlug, taskId, roleId = null, baseBranch = 'HEAD', dryRun = false }) {
  const name = roleId
    ? `${featureSlug}-${taskId}-${roleId}`
    : `${featureSlug}-${taskId}`;
  const branch = roleId ? `agent/${featureSlug}/${roleId}/${taskId}` : `agent/${featureSlug}/${taskId}`;
  const worktreePath = join(root, WORKTREE_BASE, name);

  // Ensure parent directory exists
  const baseDir = join(root, WORKTREE_BASE);
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  // Check if worktree already exists
  if (existsSync(worktreePath)) {
    // Worktree already exists — return existing info
    return { path: worktreePath, branch, name, dryRun, existed: true };
  }

  const cmd = `git worktree add -b "${branch}" "${worktreePath}" ${baseBranch}`;

  if (dryRun) {
    return { path: worktreePath, branch, name, dryRun: true, cmd };
  }

  try {
    execSync(cmd, { cwd: root, stdio: 'pipe' });
  } catch (err) {
    // Branch might already exist — try without -b
    try {
      execSync(`git worktree add "${worktreePath}" "${branch}"`, { cwd: root, stdio: 'pipe' });
    } catch (err2) {
      throw new Error(`Failed to create worktree: ${err2.stderr?.toString() || err2.message}`);
    }
  }

  return { path: worktreePath, branch, name, dryRun: false };
}

/**
 * Remove a git worktree.
 *
 * @param {string} root — repo root
 * @param {object} opts
 * @param {string} opts.worktreePath — path to the worktree
 * @param {boolean} [opts.force=false] — force removal even if dirty
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ removed: boolean, path: string }}
 */
export function removeWorktree(root, { worktreePath, force = false, dryRun = false }) {
  if (!existsSync(worktreePath)) {
    return { removed: false, path: worktreePath, reason: 'not_found' };
  }

  const cmd = `git worktree remove "${worktreePath}"${force ? ' --force' : ''}`;

  if (dryRun) {
    return { removed: false, path: worktreePath, dryRun: true, cmd };
  }

  try {
    execSync(cmd, { cwd: root, stdio: 'pipe' });
    return { removed: true, path: worktreePath };
  } catch (err) {
    if (force) {
      throw new Error(`Failed to remove worktree: ${err.stderr?.toString() || err.message}`);
    }
    // Retry with --force
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { cwd: root, stdio: 'pipe' });
      return { removed: true, path: worktreePath, forced: true };
    } catch (err2) {
      throw new Error(`Failed to remove worktree (forced): ${err2.stderr?.toString() || err2.message}`);
    }
  }
}

/**
 * Merge a worktree branch back to the current branch, then cleanup.
 *
 * @param {string} root — repo root
 * @param {object} opts
 * @param {string} opts.worktreePath — path to the worktree
 * @param {string} opts.branch — branch name to merge
 * @param {string} opts.featureSlug
 * @param {string} opts.taskId
 * @param {boolean} [opts.deleteBranch=true] — delete branch after merge
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ merged: boolean, branch: string, conflicts?: string[] }}
 */
export function mergeWorktree(root, { worktreePath, branch, featureSlug, taskId, deleteBranch = true, dryRun = false }) {
  const commitMsg = `task(${featureSlug}): ${taskId}`;

  if (dryRun) {
    return {
      merged: false,
      branch,
      dryRun: true,
      cmds: [
        `git merge --no-ff "${branch}" -m "${commitMsg}"`,
        `git worktree remove "${worktreePath}"`,
        deleteBranch ? `git branch -d "${branch}"` : null,
      ].filter(Boolean),
    };
  }

  try {
    // Merge the branch
    execSync(`git merge --no-ff "${branch}" -m "${commitMsg}"`, { cwd: root, stdio: 'pipe' });
  } catch (err) {
    // Merge conflict
    const stderr = err.stderr?.toString() || '';
    const conflicts = extractConflictFiles(stderr);
    // Abort the merge to leave repo clean
    try { execSync('git merge --abort', { cwd: root, stdio: 'pipe' }); } catch { /* ignore */ }
    return { merged: false, branch, conflicts, error: 'merge_conflict' };
  }

  // Remove worktree
  try {
    execSync(`git worktree remove "${worktreePath}"`, { cwd: root, stdio: 'pipe' });
  } catch {
    // Force remove if normal remove fails
    try { execSync(`git worktree remove "${worktreePath}" --force`, { cwd: root, stdio: 'pipe' }); } catch { /* best effort */ }
  }

  // Delete branch
  if (deleteBranch) {
    try {
      execSync(`git branch -d "${branch}"`, { cwd: root, stdio: 'pipe' });
    } catch { /* branch might have upstream refs */ }
  }

  return { merged: true, branch };
}

/**
 * Validate a worktree — check if it's clean and has no unresolved issues.
 *
 * @param {string} worktreePath — path to the worktree
 * @returns {{ valid: boolean, clean: boolean, uncommitted: number, errors: string[] }}
 */
export function validateWorktree(worktreePath) {
  if (!existsSync(worktreePath)) {
    return { valid: false, clean: false, uncommitted: 0, errors: ['Worktree path does not exist'] };
  }

  const errors = [];

  // Check git status
  let uncommitted = 0;
  try {
    const status = execSync('git status --porcelain', { cwd: worktreePath, stdio: 'pipe' }).toString().trim();
    if (status) {
      uncommitted = status.split('\n').length;
    }
  } catch (err) {
    errors.push(`git status failed: ${err.message}`);
  }

  // Check if HEAD is valid
  try {
    execSync('git rev-parse HEAD', { cwd: worktreePath, stdio: 'pipe' });
  } catch {
    errors.push('HEAD is not valid');
  }

  return {
    valid: errors.length === 0,
    clean: uncommitted === 0,
    uncommitted,
    errors,
  };
}

/**
 * List all active git worktrees (parsed from porcelain output).
 *
 * @param {string} root — repo root
 * @returns {Array<{ path: string, head: string, branch: string|null, bare: boolean }>}
 */
export function listWorktrees(root) {
  let output;
  try {
    output = execSync('git worktree list --porcelain', { cwd: root, stdio: 'pipe' }).toString();
  } catch {
    return [];
  }

  return parsePorcelainWorktreeList(output);
}

/**
 * Parse git worktree list --porcelain output.
 *
 * Format:
 *   worktree /path/to/worktree
 *   HEAD abc123
 *   branch refs/heads/main
 *   <blank line>
 *
 * @param {string} output
 * @returns {Array<{ path: string, head: string, branch: string|null, bare: boolean }>}
 */
export function parsePorcelainWorktreeList(output) {
  const worktrees = [];
  let current = null;

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: line.slice(9), head: '', branch: null, bare: false };
    } else if (line.startsWith('HEAD ') && current) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ') && current) {
      const ref = line.slice(7);
      current.branch = ref.replace('refs/heads/', '');
    } else if (line === 'bare' && current) {
      current.bare = true;
    } else if (line.trim() === '' && current) {
      worktrees.push(current);
      current = null;
    }
  }
  if (current) worktrees.push(current);

  return worktrees;
}

/**
 * Prune stale worktree references.
 *
 * @param {string} root — repo root
 * @param {boolean} [dryRun=false]
 * @returns {{ pruned: boolean }}
 */
export function pruneWorktrees(root, dryRun = false) {
  if (dryRun) {
    const output = execSync('git worktree prune --dry-run', { cwd: root, stdio: 'pipe' }).toString();
    return { pruned: false, dryRun: true, output };
  }
  execSync('git worktree prune', { cwd: root, stdio: 'pipe' });
  return { pruned: true };
}

/**
 * Get info for a single worktree by path.
 *
 * @param {string} root — repo root
 * @param {string} worktreePath — worktree path to find
 * @returns {object|null} — worktree info or null if not found
 */
export function getWorktreeInfo(root, worktreePath) {
  let realTarget;
  try { realTarget = realpathSync(worktreePath); } catch { realTarget = worktreePath; }
  const all = listWorktrees(root);
  return all.find(w => {
    let wp;
    try { wp = realpathSync(w.path); } catch { wp = w.path; }
    return wp === realTarget;
  }) || null;
}

/**
 * List only agent worktrees (those under .claude/worktrees/).
 *
 * @param {string} root
 * @returns {Array<{ path: string, head: string, branch: string|null }>}
 */
export function listAgentWorktrees(root) {
  let base;
  try { base = realpathSync(join(root, WORKTREE_BASE)); } catch { base = join(root, WORKTREE_BASE); }
  return listWorktrees(root).filter(w => {
    let wp;
    try { wp = realpathSync(w.path); } catch { wp = w.path; }
    return wp.startsWith(base);
  });
}

// ── Plan-based Worktree API ──

const _worktreePlans = new Map();

/**
 * Plan a worktree without creating it.
 *
 * @param {object} opts
 * @param {string} opts.root - repo root
 * @param {string} opts.featureSlug - feature slug
 * @param {string} opts.roleId - role ID
 * @returns {{ branch: string, path: string, featureSlug: string, roleId: string, mergeStrategy: string }}
 */
export function planWorktree({ root, featureSlug, roleId }) {
  const branch = `agent/${featureSlug}/${roleId}`;
  const name = `${featureSlug}-${roleId}`;
  const path = join(root, WORKTREE_BASE, name);
  const plan = {
    branch,
    path,
    name,
    featureSlug,
    roleId,
    mergeStrategy: 'no-ff',
    createdAt: new Date().toISOString(),
  };
  const key = `${root}::${featureSlug}::${roleId}`;
  _worktreePlans.set(key, plan);
  return plan;
}

/**
 * List all planned worktrees for a given root.
 *
 * @param {object} opts
 * @param {string} opts.root - repo root
 * @returns {Array<object>}
 */
export function listWorktreePlans({ root }) {
  const plans = [];
  for (const [key, plan] of _worktreePlans) {
    if (key.startsWith(`${root}::`)) {
      plans.push(plan);
    }
  }
  return plans;
}

// ── Helpers ──

function extractConflictFiles(stderr) {
  const conflicts = [];
  for (const line of stderr.split('\n')) {
    const match = line.match(/CONFLICT.*:\s+(.+)/);
    if (match) conflicts.push(match[1].trim());
  }
  return conflicts;
}
