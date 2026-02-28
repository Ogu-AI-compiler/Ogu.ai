/**
 * Wave Conflict Detector — detect semantic conflicts between parallel agents.
 *
 * Checks file-level overlap between agents running in the same wave.
 */

/**
 * Detect conflicts among agents based on file overlap.
 *
 * @param {object} opts - { agents: Array<{ id, files: string[] }> }
 * @returns {object} { hasConflicts, conflicts }
 */
export function detectConflicts({ agents }) {
  const fileToAgents = new Map();

  for (const agent of agents) {
    for (const file of agent.files) {
      if (!fileToAgents.has(file)) fileToAgents.set(file, []);
      fileToAgents.get(file).push(agent.id);
    }
  }

  const conflicts = [];
  for (const [file, agentIds] of fileToAgents) {
    if (agentIds.length > 1) {
      conflicts.push({ file, agents: agentIds });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    totalFiles: fileToAgents.size,
    totalAgents: agents.length,
  };
}
