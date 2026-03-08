/**
 * Config Loader — load and merge configuration from multiple sources.
 */
export function createConfigLoader() {
  const sources = [];
  let merged = {};
  function addSource(name, config, priority = 0) {
    sources.push({ name, config, priority });
    sources.sort((a, b) => a.priority - b.priority);
    _rebuild();
  }
  function _rebuild() {
    merged = {};
    for (const s of sources) Object.assign(merged, s.config);
  }
  function get(key, defaultVal = undefined) {
    return key in merged ? merged[key] : defaultVal;
  }
  function getAll() { return { ...merged }; }
  function listSources() { return sources.map(s => s.name); }
  function removeSource(name) {
    const idx = sources.findIndex(s => s.name === name);
    if (idx >= 0) { sources.splice(idx, 1); _rebuild(); }
  }
  return { addSource, get, getAll, listSources, removeSource };
}
