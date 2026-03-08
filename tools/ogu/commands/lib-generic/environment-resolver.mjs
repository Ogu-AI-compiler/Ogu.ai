/**
 * Environment Resolver — resolve environment-specific values.
 *
 * Define per-environment configs with optional defaults.
 */

/**
 * Create an environment resolver.
 *
 * @param {object} [opts] - { defaults: object }
 * @returns {object} Resolver with define/resolve/listEnvironments
 */
export function createEnvironmentResolver(opts = {}) {
  const defaults = opts.defaults || {};
  const environments = new Map();

  function define(envName, config) {
    environments.set(envName, config);
  }

  function resolve(envName) {
    if (!environments.has(envName)) {
      throw new Error(`Unknown environment: ${envName}`);
    }
    return { ...defaults, ...environments.get(envName) };
  }

  function listEnvironments() {
    return Array.from(environments.keys());
  }

  return { define, resolve, listEnvironments };
}
