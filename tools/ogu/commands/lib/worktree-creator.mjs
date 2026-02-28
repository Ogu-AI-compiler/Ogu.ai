/**
 * Worktree Creator — convenience wrapper around worktree-manager.
 *
 * Returns a stateful creator object that tracks worktrees it has created.
 * Used by runner-worker and agent-executor for per-task isolation.
 */

import { createWorktree, removeWorktree, listAgentWorktrees, validateWorktree } from './worktree-manager.mjs';

/**
 * Create a worktree creator with tracking.
 *
 * @param {{ repoRoot: string, dryRun?: boolean }} opts
 * @returns {object} Creator with create/remove/list/get/validate
 */
export function createWorktreeCreator({ repoRoot, dryRun = false }) {
  const tracked = new Map(); // branch → { branch, path, agentId, taskId, feature, createdAt }

  function plan({ agentId, taskId, feature }) {
    const branch = agentId ? `agent/${feature}/${agentId}/${taskId}` : `agent/${feature}/${taskId}`;
    const name = agentId ? `${feature}-${taskId}-${agentId}` : `${feature}-${taskId}`;
    const path = `${repoRoot}/.claude/worktrees/${name}`;
    return { branch, path, agentId, taskId, feature };
  }

  async function create({ agentId, taskId, feature }) {
    const result = createWorktree(repoRoot, {
      featureSlug: feature,
      taskId,
      roleId: agentId,
      dryRun,
    });

    const entry = {
      branch: result.branch,
      path: result.path,
      agentId,
      taskId,
      feature,
      createdAt: new Date().toISOString(),
      dryRun: result.dryRun || false,
    };

    tracked.set(result.branch, entry);
    return entry;
  }

  function remove(branch) {
    const entry = tracked.get(branch);
    if (entry) {
      try {
        removeWorktree(repoRoot, { worktreePath: entry.path, force: true, dryRun });
      } catch { /* best effort */ }
      tracked.delete(branch);
    }
    return entry || null;
  }

  function validate(branch) {
    const entry = tracked.get(branch);
    if (!entry) return { valid: false, errors: ['Branch not tracked'] };
    return validateWorktree(entry.path);
  }

  function list() {
    return Array.from(tracked.values());
  }

  function get(branch) {
    return tracked.get(branch) || null;
  }

  function listAll() {
    return listAgentWorktrees(repoRoot);
  }

  return { plan, create, remove, validate, list, get, listAll };
}
