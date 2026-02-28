/**
 * Feature Flag System — toggle features on/off with rollout percentages.
 */

/**
 * Create a feature flag manager.
 * @returns {object} Manager with setFlag/isEnabled/removeFlag/listFlags
 */
export function createFlagManager() {
  const flags = new Map();

  function setFlag(id, { enabled, rolloutPercent = 100 } = {}) {
    flags.set(id, { id, enabled, rolloutPercent });
  }

  function isEnabled(id) {
    const flag = flags.get(id);
    if (!flag) return false;
    return flag.enabled;
  }

  function removeFlag(id) {
    flags.delete(id);
  }

  function listFlags() {
    return [...flags.values()];
  }

  return { setFlag, isEnabled, removeFlag, listFlags };
}
