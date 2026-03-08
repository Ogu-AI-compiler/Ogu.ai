/**
 * Hook Registry — before/after hooks for pipeline phases.
 */

/**
 * Create a hook registry instance.
 * @returns {object} Registry with before/after/run/getHooks
 */
export function createHookRegistry() {
  const hooks = new Map(); // phase -> { before: [], after: [] }

  function ensure(phase) {
    if (!hooks.has(phase)) hooks.set(phase, { before: [], after: [] });
    return hooks.get(phase);
  }

  function before(phase, handler) {
    ensure(phase).before.push(handler);
  }

  function after(phase, handler) {
    ensure(phase).after.push(handler);
  }

  function getHooks(phase) {
    return ensure(phase);
  }

  function run(phase, action) {
    const h = ensure(phase);
    for (const fn of h.before) fn();
    const result = action();
    for (const fn of h.after) fn();
    return result;
  }

  return { before, after, run, getHooks };
}
