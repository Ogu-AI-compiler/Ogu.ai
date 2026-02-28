/**
 * Capability Matcher — match task requirements to agent capabilities.
 */

/**
 * Match required capabilities against available ones.
 *
 * @param {{ required: string[], available: string[] }} params
 * @returns {{ matched: boolean, score: number, missing: string[] }}
 */
export function matchCapabilities({ required, available }) {
  if (required.length === 0) {
    return { matched: true, score: 1.0, missing: [] };
  }

  const availableSet = new Set(available);
  const missing = required.filter(c => !availableSet.has(c));
  const matched = missing.length === 0;
  const score = (required.length - missing.length) / required.length;

  return { matched, score, missing };
}

/**
 * Find the best matching agent from a list.
 *
 * @param {{ required: string[], agents: Array<{ id: string, capabilities: string[] }> }} params
 * @returns {object|null} Best matching agent or null
 */
export function findBestMatch({ required, agents }) {
  let bestAgent = null;
  let bestScore = -1;

  for (const agent of agents) {
    const result = matchCapabilities({ required, available: agent.capabilities });
    if (result.score > bestScore) {
      bestScore = result.score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}
