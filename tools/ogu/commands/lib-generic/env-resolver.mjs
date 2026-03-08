/**
 * Env Resolver — resolve environment variables with defaults and overrides.
 */
export function createEnvResolver(env = {}) {
  const overrides = {};
  const defaults = {};
  function resolve(key) {
    if (key in overrides) return overrides[key];
    if (key in env) return env[key];
    if (key in defaults) return defaults[key];
    return undefined;
  }
  function setDefault(key, value) { defaults[key] = value; }
  function override(key, value) { overrides[key] = value; }
  function resolveAll(keys) {
    const result = {};
    for (const k of keys) result[k] = resolve(k);
    return result;
  }
  function has(key) { return resolve(key) !== undefined; }
  return { resolve, setDefault, override, resolveAll, has };
}
