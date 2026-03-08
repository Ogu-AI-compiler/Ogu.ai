/**
 * DI Container — register and resolve dependencies.
 */

/**
 * Create a dependency injection container.
 *
 * @returns {object} Container with register/registerFactory/registerSingleton/resolve/has
 */
export function createContainer() {
  const registry = new Map(); // name → { type, value|factory, instance? }

  function register(name, value) {
    registry.set(name, { type: 'value', value });
  }

  function registerFactory(name, factory) {
    registry.set(name, { type: 'factory', factory });
  }

  function registerSingleton(name, factory) {
    registry.set(name, { type: 'singleton', factory, instance: undefined, created: false });
  }

  function resolve(name) {
    const entry = registry.get(name);
    if (!entry) throw new Error(`Dependency "${name}" not registered`);

    switch (entry.type) {
      case 'value':
        return entry.value;
      case 'factory':
        return entry.factory();
      case 'singleton':
        if (!entry.created) {
          entry.instance = entry.factory();
          entry.created = true;
        }
        return entry.instance;
    }
  }

  function has(name) {
    return registry.has(name);
  }

  return { register, registerFactory, registerSingleton, resolve, has };
}
