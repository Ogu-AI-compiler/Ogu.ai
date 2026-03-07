import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getAuditDir } from '../../ogu/commands/lib/runtime-paths.mjs';

/**
 * Kadima Audit Utilities — Query, analyze, and archive audit trail.
 *
 * Complements audit-emitter.mjs (which handles writing).
 * This module provides read-side operations: query, aggregate, archive, replay.
 *
 * Audit trail: .ogu/audit/current.jsonl + .ogu/audit/YYYY-MM-DD.jsonl
 * Index:       .ogu/audit/index.json
 */

const AUDIT_DIR = (root) => getAuditDir(root);

// ── Loading ──

/**
 * Load all events from current.jsonl.
 */
export function loadAuditLog(root) {
  const file = join(AUDIT_DIR(root), 'current.jsonl');
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

/**
 * Load events from a specific date's log.
 */
export function loadDailyLog(root, date) {
  const file = join(AUDIT_DIR(root), `${date}.jsonl`);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

/**
 * Load the audit index.
 */
export function loadIndex(root) {
  const indexPath = join(AUDIT_DIR(root), 'index.json');
  if (!existsSync(indexPath)) return { byType: {}, byFeature: {}, byDay: {}, total: 0 };
  try {
    return JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch {
    return { byType: {}, byFeature: {}, byDay: {}, total: 0 };
  }
}

// ── Querying ──

/**
 * Query audit events with filters.
 *
 * @param {string} root
 * @param {object} filters
 * @param {string} [filters.type] - Event type (exact match)
 * @param {string} [filters.typePrefix] - Event type prefix (e.g., 'agent.' matches 'agent.started')
 * @param {string} [filters.source] - Source (kadima, cli, etc.)
 * @param {string} [filters.severity] - Severity filter
 * @param {string} [filters.feature] - Feature slug
 * @param {string} [filters.actorId] - Actor ID
 * @param {string} [filters.since] - ISO8601 start (inclusive)
 * @param {string} [filters.until] - ISO8601 end (exclusive)
 * @param {number} [filters.limit] - Max results (default 100)
 * @returns {object[]}
 */
export function queryAudit(root, filters = {}) {
  const events = loadAuditLog(root);
  const limit = filters.limit || 100;
  const results = [];

  for (const e of events) {
    if (filters.type && e.type !== filters.type) continue;
    if (filters.typePrefix && !e.type?.startsWith(filters.typePrefix)) continue;
    if (filters.source && e.source !== filters.source) continue;
    if (filters.severity && e.severity !== filters.severity) continue;
    if (filters.feature && e.feature !== filters.feature) continue;
    if (filters.actorId && e.actor?.id !== filters.actorId) continue;
    if (filters.since && e.timestamp < filters.since) continue;
    if (filters.until && e.timestamp >= filters.until) continue;

    results.push(e);
    if (results.length >= limit) break;
  }

  return results;
}

// ── Analysis ──

/**
 * Analyze audit events and produce aggregate statistics.
 *
 * @param {object[]} events - Array of audit events
 * @returns {object} Analysis result
 */
export function analyzeAudit(events) {
  if (!events || events.length === 0) {
    return {
      total: 0,
      byType: {},
      bySeverity: { info: 0, warn: 0, error: 0, critical: 0 },
      bySource: {},
      byFeature: {},
      timeRange: null,
      errorRate: 0,
      topActors: [],
    };
  }

  const byType = {};
  const bySeverity = { info: 0, warn: 0, error: 0, critical: 0 };
  const bySource = {};
  const byFeature = {};
  const actorCounts = {};

  let earliest = events[0].timestamp;
  let latest = events[0].timestamp;

  for (const e of events) {
    // By type
    byType[e.type] = (byType[e.type] || 0) + 1;

    // By severity
    if (e.severity && bySeverity[e.severity] !== undefined) {
      bySeverity[e.severity]++;
    }

    // By source
    if (e.source) {
      bySource[e.source] = (bySource[e.source] || 0) + 1;
    }

    // By feature
    if (e.feature) {
      byFeature[e.feature] = (byFeature[e.feature] || 0) + 1;
    }

    // Actors
    const actorId = e.actor?.id;
    if (actorId) {
      actorCounts[actorId] = (actorCounts[actorId] || 0) + 1;
    }

    // Time range
    if (e.timestamp < earliest) earliest = e.timestamp;
    if (e.timestamp > latest) latest = e.timestamp;
  }

  const errorCount = (bySeverity.error || 0) + (bySeverity.critical || 0);
  const topActors = Object.entries(actorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  return {
    total: events.length,
    byType,
    bySeverity,
    bySource,
    byFeature,
    timeRange: { from: earliest, to: latest },
    errorRate: events.length > 0 ? errorCount / events.length : 0,
    topActors,
  };
}

// ── Replay ──

/**
 * Build a replay chain from a starting event by following parentEventId links.
 *
 * @param {string} root
 * @param {string} startEventId
 * @returns {object[]} Chain of events in temporal order
 */
export function replayAuditChain(root, startEventId) {
  const events = loadAuditLog(root);
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
    children.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    current = children[0];
    chain.push(current);
  }

  return chain;
}

// ── Archival ──

/**
 * Archive old audit logs. Rotates current.jsonl to a dated archive
 * and removes events older than retentionDays.
 *
 * @param {string} root
 * @param {object} [options]
 * @param {number} [options.retentionDays] - Keep logs for N days (default 30)
 * @returns {{ archived, removed, currentSize }}
 */
export function archiveAuditLog(root, options = {}) {
  const retentionDays = options.retentionDays || 30;
  const dir = AUDIT_DIR(root);
  if (!existsSync(dir)) return { archived: 0, removed: 0, currentSize: 0 };

  let archived = 0;
  let removed = 0;

  // Rotate current.jsonl if it has events from previous days
  const currentPath = join(dir, 'current.jsonl');
  if (existsSync(currentPath)) {
    const events = loadAuditLog(root);
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = events.filter(e => e.timestamp?.startsWith(today));
    const olderEvents = events.filter(e => !e.timestamp?.startsWith(today));

    if (olderEvents.length > 0) {
      // Group older events by date and append to daily files
      const byDate = {};
      for (const e of olderEvents) {
        const date = e.timestamp?.slice(0, 10) || 'unknown';
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(e);
      }

      for (const [date, dateEvents] of Object.entries(byDate)) {
        const dailyPath = join(dir, `${date}.jsonl`);
        const lines = dateEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
        if (existsSync(dailyPath)) {
          appendFileSync(dailyPath, lines, 'utf8');
        } else {
          writeFileSync(dailyPath, lines, 'utf8');
        }
        archived += dateEvents.length;
      }

      // Rewrite current.jsonl with only today's events
      const currentLines = todayEvents.map(e => JSON.stringify(e)).join('\n');
      writeFileSync(currentPath, currentLines ? currentLines + '\n' : '', 'utf8');
    }
  }

  // Remove daily files older than retention
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const files = readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  for (const f of files) {
    const date = f.replace('.jsonl', '');
    if (date < cutoffStr) {
      unlinkSync(join(dir, f));
      removed++;
    }
  }

  const currentSize = existsSync(currentPath)
    ? readFileSync(currentPath, 'utf8').trim().split('\n').filter(Boolean).length
    : 0;

  return { archived, removed, currentSize };
}

/**
 * List available daily audit log files.
 *
 * @returns {{ date, path, eventCount }[]}
 */
export function listAuditLogs(root) {
  const dir = AUDIT_DIR(root);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  return files.sort().map(f => {
    const filePath = join(dir, f);
    const lines = readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
    return {
      date: f.replace('.jsonl', ''),
      path: filePath,
      eventCount: lines.length,
    };
  });
}
