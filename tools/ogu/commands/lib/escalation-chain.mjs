/**
 * Escalation Chain — timeout-based escalation through role hierarchy.
 */

/**
 * Create an escalation chain manager.
 *
 * @param {{ chain: string[], timeoutMs: number }} opts
 * @returns {object} Chain with getCurrentApprover/escalate/isExhausted/getEscalationHistory
 */
export function createEscalationChain({ chain, timeoutMs = 60000 }) {
  let currentIndex = 0;
  const history = [];

  function getCurrentApprover() {
    if (currentIndex >= chain.length) return null;
    return chain[currentIndex];
  }

  function escalate() {
    if (currentIndex >= chain.length) {
      throw new Error('Escalation chain exhausted');
    }
    const from = chain[currentIndex];
    currentIndex++;
    const to = currentIndex < chain.length ? chain[currentIndex] : null;
    history.push({
      from,
      to,
      escalatedAt: new Date().toISOString(),
      timeoutMs,
    });
    return { from, to };
  }

  function isExhausted() {
    return currentIndex >= chain.length;
  }

  function getEscalationHistory() {
    return [...history];
  }

  function getTimeoutMs() {
    return timeoutMs;
  }

  return { getCurrentApprover, escalate, isExhausted, getEscalationHistory, getTimeoutMs };
}
