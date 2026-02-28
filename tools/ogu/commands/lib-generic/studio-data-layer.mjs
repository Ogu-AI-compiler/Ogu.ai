/**
 * Studio Data Layer — backend query functions for Studio API endpoints.
 *
 * Provides searchAudit, getBudgetSummary for the Studio dashboard.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, readJsonSafe } from '../../util.mjs';

/**
 * Search audit events with filters.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} [opts.feature] - Filter by feature
 * @param {string} [opts.type] - Filter by event type
 * @param {string} [opts.severity] - Filter by severity
 * @param {string} [opts.since] - ISO date string, events after this time
 * @param {number} [opts.limit] - Max results
 * @returns {Array}
 */
export function searchAudit({ root, feature, type, severity, since, limit } = {}) {
  root = root || repoRoot();
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (!existsSync(auditPath)) return [];

  const content = readFileSync(auditPath, 'utf8').trim();
  if (!content) return [];

  let events = content.split('\n').map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);

  if (feature) events = events.filter(e => e.feature === feature);
  if (type) events = events.filter(e => e.type === type);
  if (severity) events = events.filter(e => e.severity === severity);
  if (since) {
    const sinceDate = new Date(since);
    events = events.filter(e => new Date(e.timestamp) >= sinceDate);
  }

  if (limit && limit > 0) events = events.slice(0, limit);

  return events;
}

/**
 * Get budget summary with alert level.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @returns {object}
 */
export function getBudgetSummary({ root } = {}) {
  root = root || repoRoot();
  const budgetPath = join(root, '.ogu/budget/budget-state.json');
  const budget = readJsonSafe(budgetPath);

  if (!budget) {
    return {
      dailySpent: 0, monthlySpent: 0,
      dailyLimit: 0, monthlyLimit: 0,
      dailyPercent: 0, monthlyPercent: 0,
      alertLevel: 'normal',
    };
  }

  const dailyPercent = budget.dailyLimit > 0 ? (budget.dailySpent / budget.dailyLimit) * 100 : 0;
  const monthlyPercent = budget.monthlyLimit > 0 ? (budget.monthlySpent / budget.monthlyLimit) * 100 : 0;

  const maxPercent = Math.max(dailyPercent, monthlyPercent);
  let alertLevel = 'normal';
  if (maxPercent >= 90) alertLevel = 'critical';
  else if (maxPercent >= 75) alertLevel = 'warning';

  return {
    dailySpent: budget.dailySpent || 0,
    monthlySpent: budget.monthlySpent || 0,
    dailyLimit: budget.dailyLimit || 0,
    monthlyLimit: budget.monthlyLimit || 0,
    dailyPercent: Math.round(dailyPercent * 100) / 100,
    monthlyPercent: Math.round(monthlyPercent * 100) / 100,
    alertLevel,
    lastReset: budget.lastReset || null,
  };
}
