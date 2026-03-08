/**
 * event-bus.mjs — In-process publish/subscribe event bus.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },

    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },

    emit(event, payload) {
      const fns = listeners.get(event);
      if (fns) for (const fn of fns) { try { fn(payload); } catch { /* isolate */ } }
      const wildcards = listeners.get('*');
      if (wildcards) for (const fn of wildcards) { try { fn(event, payload); } catch { /* isolate */ } }
    },

    once(event, fn) {
      const wrapper = (payload) => { fn(payload); listeners.get(event)?.delete(wrapper); };
      this.on(event, wrapper);
    },

    clear(event) {
      if (event) listeners.delete(event); else listeners.clear();
    },
  };
}
