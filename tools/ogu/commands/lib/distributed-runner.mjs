import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Distributed Runner — remote runner registration and health tracking.
 *
 * Manages a registry of distributed runners that can execute tasks.
 * Stored in .ogu/kadima/runners.json.
 */

function registryPath(root) {
  const dir = join(root, '.ogu/kadima');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'runners.json');
}

function loadRegistry(root) {
  const p = registryPath(root);
  if (!existsSync(p)) return { runners: [] };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { runners: [] }; }
}

function saveRegistry(root, registry) {
  writeFileSync(registryPath(root), JSON.stringify(registry, null, 2));
}

/**
 * Register a runner.
 */
export function registerRunner({ root, id, host, port, capabilities, maxConcurrency } = {}) {
  root = root || repoRoot();
  const registry = loadRegistry(root);

  const entry = {
    id,
    host,
    port,
    capabilities: capabilities || [],
    maxConcurrency: maxConcurrency || 1,
    status: 'idle',
    activeTasks: 0,
    registeredAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
  };

  const idx = registry.runners.findIndex(r => r.id === id);
  if (idx >= 0) {
    registry.runners[idx] = entry;
  } else {
    registry.runners.push(entry);
  }

  saveRegistry(root, registry);
  return entry;
}

/**
 * List all registered runners.
 */
export function listRunners({ root } = {}) {
  root = root || repoRoot();
  return loadRegistry(root).runners;
}

/**
 * Update runner status.
 */
export function updateRunnerStatus({ root, id, status, activeTasks } = {}) {
  root = root || repoRoot();
  const registry = loadRegistry(root);
  const runner = registry.runners.find(r => r.id === id);
  if (!runner) return null;

  if (status) runner.status = status;
  if (activeTasks !== undefined) runner.activeTasks = activeTasks;
  runner.lastHeartbeat = new Date().toISOString();

  saveRegistry(root, registry);
  return runner;
}

/**
 * Remove a runner.
 */
export function removeRunner({ root, id } = {}) {
  root = root || repoRoot();
  const registry = loadRegistry(root);
  registry.runners = registry.runners.filter(r => r.id !== id);
  saveRegistry(root, registry);
}
