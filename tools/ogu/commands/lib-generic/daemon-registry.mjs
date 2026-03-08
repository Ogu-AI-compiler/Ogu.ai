/**
 * Daemon Registry — service discovery for runners and daemons.
 */

/**
 * Create a daemon registry for service discovery.
 *
 * @returns {object} Registry with register/unregister/discover/getService/heartbeat/listServices
 */
export function createDaemonRegistry() {
  const services = new Map(); // name → service

  function register({ name, type, host, port, capabilities = [] }) {
    services.set(name, {
      name,
      type,
      host,
      port,
      capabilities,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'healthy',
    });
  }

  function unregister(name) {
    services.delete(name);
  }

  function discover(type) {
    return Array.from(services.values()).filter(s => s.type === type);
  }

  function getService(name) {
    return services.get(name) || null;
  }

  function heartbeat(name) {
    const svc = services.get(name);
    if (svc) {
      svc.lastSeen = new Date().toISOString();
      svc.status = 'healthy';
    }
  }

  function listServices() {
    return Array.from(services.values());
  }

  return { register, unregister, discover, getService, heartbeat, listServices };
}
