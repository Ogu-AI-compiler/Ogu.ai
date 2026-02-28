/**
 * Observability Pipeline — unified observability with metrics/logs/traces.
 */

/**
 * Create an observability pipeline.
 *
 * @returns {object} Pipeline with addSink/emit/query/getStats
 */
export function createObservabilityPipeline() {
  const sinks = new Map(); // name → fn
  const events = [];

  function addSink(name, fn) {
    sinks.set(name, fn);
  }

  function emit(event) {
    const timestamped = { ...event, timestamp: event.timestamp || new Date().toISOString() };
    events.push(timestamped);
    for (const sink of sinks.values()) {
      sink(timestamped);
    }
  }

  function query({ type, agentId, from, to } = {}) {
    return events.filter(e => {
      if (type && e.type !== type) return false;
      if (agentId && e.agentId !== agentId) return false;
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    });
  }

  function getStats() {
    const byType = {};
    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return { totalEvents: events.length, byType };
  }

  return { addSink, emit, query, getStats };
}
