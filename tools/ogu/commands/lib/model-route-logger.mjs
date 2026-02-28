/**
 * Model Route Logger — log routing decisions to model-log.jsonl.
 */

/**
 * Create a model route logger.
 *
 * @returns {object} Logger with log/getEntries/getEscalations/getStats
 */
export function createModelRouteLogger() {
  const entries = [];

  function log({ role, requestedModel, selectedModel, reason, tokensIn = 0, tokensOut = 0 }) {
    entries.push({
      role,
      requestedModel,
      selectedModel,
      reason,
      tokensIn,
      tokensOut,
      timestamp: new Date().toISOString(),
    });
  }

  function getEntries() {
    return [...entries];
  }

  function getEscalations() {
    return entries.filter(e => e.reason && e.reason.startsWith('escalation'));
  }

  function getStats() {
    const byModel = {};
    const byRole = {};
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    for (const e of entries) {
      byModel[e.selectedModel] = (byModel[e.selectedModel] || 0) + 1;
      byRole[e.role] = (byRole[e.role] || 0) + 1;
      totalTokensIn += e.tokensIn;
      totalTokensOut += e.tokensOut;
    }

    return {
      totalRequests: entries.length,
      byModel,
      byRole,
      totalTokensIn,
      totalTokensOut,
      escalations: getEscalations().length,
    };
  }

  return { log, getEntries, getEscalations, getStats };
}
