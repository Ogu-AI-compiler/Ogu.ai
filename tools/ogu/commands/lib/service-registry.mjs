/**
 * service-registry.mjs — Runtime service registration and discovery.
 */
const registry = new Map();

export function registerService(name, descriptor = {}) {
  registry.set(name, { name, registeredAt: new Date().toISOString(), ...descriptor });
}

export function removeService(name) {
  registry.delete(name);
}

export function getService(name) {
  return registry.get(name) || null;
}

export function listServices() {
  return [...registry.values()];
}
