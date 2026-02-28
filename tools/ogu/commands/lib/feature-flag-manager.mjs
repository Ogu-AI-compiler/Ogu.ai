/**
 * Feature Flag Manager — toggle features on/off.
 */
export function createFeatureFlagManager() {
  const flags = new Map();

  function setFlag(name, enabled) { flags.set(name, enabled); }
  function isEnabled(name) { return flags.get(name) === true; }
  function listFlags() {
    return Array.from(flags.entries()).map(([name, enabled]) => ({ name, enabled }));
  }

  return { setFlag, isEnabled, listFlags };
}
