/**
 * Service Locator — global service discovery and lifecycle.
 */

/**
 * Create a service locator.
 *
 * @returns {object} Locator with register/get/unregister/listServices
 */
export function createServiceLocator() {
  const services = new Map();

  function register(name, service) {
    services.set(name, service);
  }

  function get(name) {
    return services.get(name) || null;
  }

  function unregister(name) {
    services.delete(name);
  }

  function listServices() {
    return Array.from(services.keys());
  }

  return { register, get, unregister, listServices };
}
