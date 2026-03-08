/**
 * Event Bus — pub/sub event system for internal communication.
 *
 * Supports on, off, emit, once, and wildcard (*) subscriptions.
 */

/**
 * Create an event bus instance.
 * @returns {object} Bus with on/off/emit/once/listenerCount
 */
export function createEventBus() {
  const listeners = new Map();

  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push({ handler, once: false });
  }

  function once(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push({ handler, once: true });
  }

  function off(event, handler) {
    if (!listeners.has(event)) return;
    const list = listeners.get(event).filter(l => l.handler !== handler);
    if (list.length === 0) listeners.delete(event);
    else listeners.set(event, list);
  }

  function emit(event, data) {
    // Specific listeners
    if (listeners.has(event)) {
      const list = listeners.get(event);
      const keep = [];
      for (const l of list) {
        l.handler(data, event);
        if (!l.once) keep.push(l);
      }
      if (keep.length === 0) listeners.delete(event);
      else listeners.set(event, keep);
    }

    // Wildcard listeners
    if (event !== '*' && listeners.has('*')) {
      const list = listeners.get('*');
      const keep = [];
      for (const l of list) {
        l.handler(data, event);
        if (!l.once) keep.push(l);
      }
      if (keep.length === 0) listeners.delete('*');
      else listeners.set('*', keep);
    }
  }

  function listenerCount(event) {
    return listeners.has(event) ? listeners.get(event).length : 0;
  }

  return { on, off, emit, once, listenerCount };
}
