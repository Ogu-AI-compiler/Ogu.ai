import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Append-only JSONL audit emitter with daily rotation and replay support.
 * Writes structured events to .ogu/audit/current.jsonl and .ogu/audit/YYYY-MM-DD.jsonl
 */

const AUDIT_DIR = () => join(repoRoot(), '.ogu/audit');
const AUDIT_FILE = () => join(AUDIT_DIR(), 'current.jsonl');
const INDEX_FILE = () => join(AUDIT_DIR(), 'index.json');

/**
 * Emit a structured audit event.
 *
 * @param {string} type - Event type (e.g. 'feature.transition', 'compile.start')
 * @param {object} payload - Event-specific data
 * @param {object} [options]
 * @param {string} [options.source] - Source service (default: 'cli')
 * @param {string} [options.severity] - Severity: info, warn, error, critical
 * @param {object} [options.actor] - { type, id }
 * @param {string} [options.feature] - Feature slug
 * @param {string} [options.parentEventId] - ID of parent event (for replay chains)
 * @param {string[]} [options.tags] - Searchable tags
 * @param {object} [options.model] - { provider, model, tokens, cost }
 * @param {object} [options.artifact] - { type, path, hash }
 * @param {object} [options.gate] - { name, passed, reason }
 */
export function emitAudit(type, payload, options = {}) {
  const dir = AUDIT_DIR();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const event = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    severity: options.severity || 'info',
    source: options.source || 'cli',
    actor: options.actor || { type: 'human', id: process.env.USER || 'unknown' },
    feature: options.feature || undefined,
    parentEventId: options.parentEventId || undefined,
    tags: options.tags || undefined,
    model: options.model || undefined,
    artifact: options.artifact || undefined,
    gate: options.gate || undefined,
    payload,
  };

  // Write to current.jsonl
  appendFileSync(AUDIT_FILE(), JSON.stringify(event) + '\n', 'utf8');

  // Write to daily file
  const today = new Date().toISOString().slice(0, 10);
  const dailyFile = join(dir, `${today}.jsonl`);
  appendFileSync(dailyFile, JSON.stringify(event) + '\n', 'utf8');

  // Update index (best-effort)
  updateIndex(dir, event);

  return event;
}

/**
 * Build a replay chain — all events from a starting event to the latest.
 * Follows parentEventId links.
 *
 * @param {string} startEventId - ID of the first event
 * @returns {object[]} Chain of events in order
 */
export function replayChain(startEventId) {
  const events = loadAllEvents();
  const byId = new Map(events.map(e => [e.id, e]));
  const byParent = new Map();
  for (const e of events) {
    if (e.parentEventId) {
      if (!byParent.has(e.parentEventId)) byParent.set(e.parentEventId, []);
      byParent.get(e.parentEventId).push(e);
    }
  }

  const chain = [];
  const start = byId.get(startEventId);
  if (!start) return chain;

  chain.push(start);
  let current = start;
  while (true) {
    const children = byParent.get(current.id);
    if (!children || children.length === 0) break;
    // Follow the first child (temporal order)
    children.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    current = children[0];
    chain.push(current);
  }

  return chain;
}

/**
 * Load all events from current.jsonl.
 */
export function loadAllEvents() {
  const file = AUDIT_FILE();
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

// ── Index management ──

function updateIndex(dir, event) {
  try {
    const indexPath = join(dir, 'index.json');
    let index = { byType: {}, byFeature: {}, byDay: {}, total: 0 };
    if (existsSync(indexPath)) {
      index = JSON.parse(readFileSync(indexPath, 'utf8'));
    }

    index.total = (index.total || 0) + 1;

    // By type
    if (!index.byType) index.byType = {};
    index.byType[event.type] = (index.byType[event.type] || 0) + 1;

    // By feature
    if (event.feature) {
      if (!index.byFeature) index.byFeature = {};
      index.byFeature[event.feature] = (index.byFeature[event.feature] || 0) + 1;
    }

    // By day
    const day = event.timestamp.slice(0, 10);
    if (!index.byDay) index.byDay = {};
    index.byDay[day] = (index.byDay[day] || 0) + 1;

    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  } catch { /* index update is best-effort */ }
}
