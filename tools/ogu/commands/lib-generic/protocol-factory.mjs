/**
 * Protocol Factory — create protocol instances via pluggable factory.
 */

export function createProtocolFactory() {
  const factories = new Map();

  function register(name, factory) {
    factories.set(name, factory);
  }

  function create(name, opts) {
    const factory = factories.get(name);
    if (!factory) throw new Error(`Unknown protocol: ${name}`);
    return factory(opts);
  }

  function listProtocols() {
    return [...factories.keys()];
  }

  return { register, create, listProtocols };
}
