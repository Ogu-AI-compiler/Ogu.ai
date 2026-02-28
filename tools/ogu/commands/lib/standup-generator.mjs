import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Standup Generator — produce daily standup report from audit trail.
 *
 * Summarizes:
 *   - Completed tasks (last 24h)
 *   - Failed tasks (last 24h)
 *   - In-progress features
 *   - Gate transitions
 */

/**
 * Generate a standup report.
 *
 * @param {object} opts
 * @param {string} [opts.root]
 * @param {number} [opts.hoursBack] - Hours to look back (default 24)
 * @returns {{ date, completed, failed, inProgress, transitions, summary }}
 */
export function generateStandup({ root, hoursBack = 24 } = {}) {
  root = root || repoRoot();

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  // Load audit events
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  let events = [];
  if (existsSync(auditPath)) {
    events = readFileSync(auditPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .filter(e => new Date(e.timestamp) >= cutoff);
  }

  const completed = events
    .filter(e => e.type === 'task.completed')
    .map(e => ({
      taskId: e.payload?.taskId,
      feature: e.payload?.feature,
      roleId: e.payload?.roleId,
      timestamp: e.timestamp,
    }));

  const failed = events
    .filter(e => e.type === 'task.failed')
    .map(e => ({
      taskId: e.payload?.taskId,
      feature: e.payload?.feature,
      roleId: e.payload?.roleId,
      error: e.payload?.error,
      timestamp: e.timestamp,
    }));

  const transitions = events
    .filter(e => e.type === 'feature.transitioned' || e.type === 'gate.passed')
    .map(e => ({
      type: e.type,
      feature: e.payload?.feature,
      detail: e.type === 'gate.passed'
        ? `Gate ${e.payload?.gate} passed`
        : `${e.payload?.from} → ${e.payload?.to}`,
      timestamp: e.timestamp,
    }));

  // In-progress: features that have tasks but aren't "done"
  const activeFeatures = new Set([
    ...completed.map(c => c.feature),
    ...failed.map(f => f.feature),
  ].filter(Boolean));

  const inProgress = [...activeFeatures].map(feature => ({
    feature,
    tasksCompleted: completed.filter(c => c.feature === feature).length,
    tasksFailed: failed.filter(f => f.feature === feature).length,
  }));

  return {
    date: new Date().toISOString().slice(0, 10),
    hoursBack,
    completed,
    failed,
    transitions,
    inProgress,
    summary: {
      tasksCompleted: completed.length,
      tasksFailed: failed.length,
      featuresActive: inProgress.length,
      transitionCount: transitions.length,
    },
  };
}
