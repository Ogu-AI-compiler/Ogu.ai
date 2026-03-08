/**
 * Dependency Injector — wire dependencies for subsystem initialization.
 *
 * Simple IoC container with factory functions, dependency resolution,
 * and optional singleton caching.
 */

/**
 * Create a DI container.
 *
 * @returns {object} Container with register/resolve
 */
export function createContainer() {
  const factories = new Map();
  const singletons = new Map();

  function register(name, factory, deps = [], opts = {}) {
    factories.set(name, { factory, deps, singleton: opts.singleton || false });
  }

  function resolve(name) {
    const entry = factories.get(name);
    if (!entry) throw new Error(`Dependency "${name}" not registered`);

    if (entry.singleton && singletons.has(name)) {
      return singletons.get(name);
    }

    const resolvedDeps = {};
    for (const dep of entry.deps) {
      resolvedDeps[dep] = resolve(dep);
    }

    const instance = entry.factory(resolvedDeps);

    if (entry.singleton) {
      singletons.set(name, instance);
    }

    return instance;
  }

  return { register, resolve };
}
