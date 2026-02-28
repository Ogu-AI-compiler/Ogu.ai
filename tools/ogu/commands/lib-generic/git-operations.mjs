/**
 * Git Operations — safe git operations for agent workflow.
 */

export const GIT_CONVENTIONS = {
  branchPrefix: 'agent/',
  commitPrefix: '[ogu]',
  separator: '/',
};

/**
 * Build a standard branch name for an agent task.
 */
export function buildBranchName({ agentId, feature, taskId }) {
  return `${GIT_CONVENTIONS.branchPrefix}${agentId}/${feature}-${taskId}`;
}

/**
 * Parse a standard branch name into components.
 */
export function parseBranchName(branch) {
  const prefix = GIT_CONVENTIONS.branchPrefix;
  if (!branch.startsWith(prefix)) {
    return { agentId: null, feature: null, taskId: null };
  }
  const rest = branch.slice(prefix.length);
  const parts = rest.split('/');
  if (parts.length < 2) return { agentId: parts[0], feature: null, taskId: null };

  const agentId = parts[0];
  const featureTask = parts.slice(1).join('/');
  const dashIdx = featureTask.lastIndexOf('-');
  if (dashIdx === -1) return { agentId, feature: featureTask, taskId: null };

  return {
    agentId,
    feature: featureTask.slice(0, dashIdx),
    taskId: featureTask.slice(dashIdx + 1),
  };
}

/**
 * Build a standard commit message.
 */
export function buildCommitMessage({ agentId, taskId, description }) {
  return `${GIT_CONVENTIONS.commitPrefix} [${agentId}] ${description} (task: ${taskId})`;
}

/**
 * Check if a branch name follows agent conventions.
 */
export function isAgentBranch(branch) {
  return branch.startsWith(GIT_CONVENTIONS.branchPrefix);
}
