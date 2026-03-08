/**
 * Allocation Strategy — select best agent for a task using scoring.
 */

export const ALLOCATION_WEIGHTS = {
  capability: 0.40,
  load: 0.30,
  budget: 0.30,
};

/**
 * Create an allocation strategy.
 *
 * @returns {object} Strategy with score/selectBest
 */
export function createAllocationStrategy() {
  function score({ agent, task }) {
    // Capability match score
    const required = task.requiredCapabilities || [];
    const available = new Set(agent.capabilities || []);
    const capMatched = required.filter(c => available.has(c)).length;
    const capScore = required.length === 0 ? 1.0 : capMatched / required.length;

    // If not all capabilities match, disqualify
    if (capScore < 1.0) return -1;

    // Load score (lower load = better)
    const loadScore = 1 - (agent.load || 0);

    // Budget score
    const budgetScore = agent.budgetRemaining || 1;

    return (
      capScore * ALLOCATION_WEIGHTS.capability +
      loadScore * ALLOCATION_WEIGHTS.load +
      budgetScore * ALLOCATION_WEIGHTS.budget
    );
  }

  function selectBest({ agents, task }) {
    let bestAgent = null;
    let bestScore = -1;

    for (const agent of agents) {
      const s = score({ agent, task });
      if (s > bestScore) {
        bestScore = s;
        bestAgent = agent;
      }
    }

    return bestScore > 0 ? bestAgent : null;
  }

  return { score, selectBest };
}
