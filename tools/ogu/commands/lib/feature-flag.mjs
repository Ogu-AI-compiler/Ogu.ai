/**
 * Feature Flag — toggle features on/off with optional conditions.
 */
export function createFeatureFlags() {
  const flags = new Map();
  function set(name, enabled, condition = null) {
    flags.set(name, { enabled, condition });
  }
  function isEnabled(name, context = {}) {
    const flag = flags.get(name);
    if (!flag) return false;
    if (!flag.enabled) return false;
    if (flag.condition) return flag.condition(context);
    return true;
  }
  function remove(name) { flags.delete(name); }
  function list() {
    return [...flags.entries()].map(([name, f]) => ({ name, enabled: f.enabled }));
  }
  function toggle(name) {
    const flag = flags.get(name);
    if (flag) flag.enabled = !flag.enabled;
  }
  return { set, isEnabled, remove, list, toggle };
}
