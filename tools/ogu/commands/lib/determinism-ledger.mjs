/**
 * Determinism Ledger — log non-deterministic events with variance tracking.
 */

/**
 * Create a determinism ledger.
 *
 * @returns {object} Ledger with logEvent/getEvents/getScore/getReport
 */
export function createDeterminismLedger() {
  const events = [];

  function logEvent({ source, reason, variance = 0 }) {
    events.push({
      source,
      reason,
      variance,
      timestamp: new Date().toISOString(),
    });
  }

  function getEvents() {
    return [...events];
  }

  function getScore() {
    if (events.length === 0) return 100;
    const totalVariance = events.reduce((s, e) => s + (e.variance || 0), 0);
    const avgVariance = totalVariance / events.length;
    // Score decreases with more events and higher variance
    const penalty = Math.min(events.length * 5, 50) + Math.min(avgVariance * 100, 50);
    return Math.max(0, Math.round(100 - penalty));
  }

  function getReport() {
    const bySource = {};
    for (const e of events) {
      if (!bySource[e.source]) {
        bySource[e.source] = { count: 0, totalVariance: 0 };
      }
      bySource[e.source].count++;
      bySource[e.source].totalVariance += e.variance || 0;
    }
    return {
      totalEvents: events.length,
      deterministicScore: getScore(),
      bySource,
    };
  }

  return { logEvent, getEvents, getScore, getReport };
}
