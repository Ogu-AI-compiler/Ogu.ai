import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Service Registry — formal service map for the Kadima ecosystem.
 *
 * Tracks all services: Kadima daemon, Studio, Preview server, etc.
 * Stored in .ogu/services.json.
 */

function registryPath(root) {
  return join(root, '.ogu/services.json');
}

function loadRegistry(root) {
  const p = registryPath(root);
  if (!existsSync(p)) return { services: [] };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveRegistry(root, registry) {
  writeFileSync(registryPath(root), JSON.stringify(registry, null, 2));
}

/**
 * Register a service.
 */
export function registerService({ root, id, name, port, protocol, healthEndpoint } = {}) {
  root = root || repoRoot();
  const registry = loadRegistry(root);

  // Update if exists, otherwise add
  const idx = registry.services.findIndex(s => s.id === id);
  const entry = {
    id,
    name,
    port,
    protocol: protocol || 'http',
    healthEndpoint: healthEndpoint || null,
    registeredAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    registry.services[idx] = entry;
  } else {
    registry.services.push(entry);
  }

  saveRegistry(root, registry);
  return entry;
}

/**
 * List all registered services.
 */
export function listServices({ root } = {}) {
  root = root || repoRoot();
  return loadRegistry(root).services;
}

/**
 * Get a specific service by ID.
 */
export function getService({ root, id } = {}) {
  root = root || repoRoot();
  return loadRegistry(root).services.find(s => s.id === id) || null;
}

/**
 * Remove a service.
 */
export function removeService({ root, id } = {}) {
  root = root || repoRoot();
  const registry = loadRegistry(root);
  registry.services = registry.services.filter(s => s.id !== id);
  saveRegistry(root, registry);
}

/**
 * In-memory service registry for runtime discovery.
 */
export function createServiceRegistry() {
  const services = new Map();

  function register({ name, url, tags = [] }) {
    services.set(name, { name, url, tags, registeredAt: Date.now() });
  }

  function discover(name) {
    return services.get(name) || null;
  }

  function discoverByTag(tag) {
    return Array.from(services.values()).filter(s => s.tags.includes(tag));
  }

  function deregister(name) {
    services.delete(name);
  }

  function listAll() {
    return Array.from(services.values());
  }

  return { register, discover, discoverByTag, deregister, listAll };
}
