/**
 * Audit Index Builder — build index for fast lookup by feature/agent/date.
 */

/**
 * Create an audit index builder.
 *
 * @returns {object} Builder with index/query/getStats/export
 */
export function createAuditIndexBuilder() {
  const events = [];
  const byFeature = new Map(); // feature → [indices]
  const byAgent = new Map();   // agentId → [indices]
  const byDate = new Map();    // date → [indices]

  function index(event) {
    const idx = events.length;
    events.push(event);

    if (event.feature) {
      if (!byFeature.has(event.feature)) byFeature.set(event.feature, []);
      byFeature.get(event.feature).push(idx);
    }
    if (event.agentId) {
      if (!byAgent.has(event.agentId)) byAgent.set(event.agentId, []);
      byAgent.get(event.agentId).push(idx);
    }
    if (event.date) {
      if (!byDate.has(event.date)) byDate.set(event.date, []);
      byDate.get(event.date).push(idx);
    }
  }

  function query({ feature, agentId, from, to } = {}) {
    let candidates = null;

    if (feature && byFeature.has(feature)) {
      candidates = new Set(byFeature.get(feature));
    }
    if (agentId && byAgent.has(agentId)) {
      const agentSet = new Set(byAgent.get(agentId));
      candidates = candidates ? intersect(candidates, agentSet) : agentSet;
    }
    if (from || to) {
      const dateIndices = new Set();
      for (const [date, indices] of byDate) {
        if (from && date < from) continue;
        if (to && date > to) continue;
        for (const i of indices) dateIndices.add(i);
      }
      candidates = candidates ? intersect(candidates, dateIndices) : dateIndices;
    }

    if (!candidates) return [...events];
    return Array.from(candidates).sort((a, b) => a - b).map(i => events[i]);
  }

  function intersect(setA, setB) {
    const result = new Set();
    for (const item of setA) {
      if (setB.has(item)) result.add(item);
    }
    return result;
  }

  function getStats() {
    return {
      totalEvents: events.length,
      features: Array.from(byFeature.keys()),
      agents: Array.from(byAgent.keys()),
      dates: Array.from(byDate.keys()).sort(),
    };
  }

  function exportIndex() {
    return {
      byFeature: Object.fromEntries(byFeature),
      byAgent: Object.fromEntries(byAgent),
      byDate: Object.fromEntries(byDate),
      totalEvents: events.length,
    };
  }

  return { index, query, getStats, exportIndex };
}
