import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Audit Index — quick lookup by feature, type, date.
 *
 * Indexes audit events from current.jsonl for fast queries.
 * Stored in .ogu/audit/index.json.
 */

function loadEvents(root) {
  const p = join(root, '.ogu/audit/current.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

/**
 * Build an index from audit events.
 */
export function buildIndex({ root } = {}) {
  root = root || repoRoot();
  const events = loadEvents(root);

  const byFeature = {};
  const byType = {};
  const byDate = {};
  const byRole = {};

  for (const e of events) {
    const feature = e.payload?.feature;
    const date = e.timestamp ? e.timestamp.slice(0, 10) : 'unknown';
    const role = e.payload?.roleId;

    if (feature) {
      if (!byFeature[feature]) byFeature[feature] = [];
      byFeature[feature].push(e.id);
    }

    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e.id);

    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(e.id);

    if (role) {
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(e.id);
    }
  }

  return {
    totalEvents: events.length,
    byFeature,
    byType,
    byDate,
    byRole,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Lookup events by feature.
 */
export function lookupByFeature({ root, feature } = {}) {
  root = root || repoRoot();
  const events = loadEvents(root);
  return events.filter(e => e.payload?.feature === feature);
}

/**
 * Save index to disk.
 */
export function saveIndex({ root, index } = {}) {
  root = root || repoRoot();
  writeFileSync(join(root, '.ogu/audit/index.json'), JSON.stringify(index, null, 2));
}

/**
 * Load index from disk.
 */
export function loadIndex({ root } = {}) {
  root = root || repoRoot();
  const p = join(root, '.ogu/audit/index.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}
