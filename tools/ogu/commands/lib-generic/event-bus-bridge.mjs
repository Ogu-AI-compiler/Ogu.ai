/**
 * Event Bus Bridge — bridge between internal event bus and external systems.
 *
 * Adapters receive forwarded events, optionally filtered.
 */

/**
 * Create an event bus bridge.
 *
 * @returns {object} Bridge with addAdapter/removeAdapter/forward/getStats
 */
export function createEventBusBridge() {
  const adapters = new Map();
  let totalForwarded = 0;

  function addAdapter({ name, handle, filter }) {
    adapters.set(name, { name, handle, filter });
  }

  function removeAdapter(name) {
    adapters.delete(name);
  }

  function forward(event) {
    totalForwarded++;
    for (const [, adapter] of adapters) {
      if (adapter.filter && !adapter.filter(event)) continue;
      adapter.handle(event);
    }
  }

  function getStats() {
    return {
      totalForwarded,
      adapterCount: adapters.size,
    };
  }

  return { addAdapter, removeAdapter, forward, getStats };
}
