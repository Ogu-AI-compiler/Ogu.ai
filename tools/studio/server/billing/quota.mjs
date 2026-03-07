/**
 * AoaS Quota Management — track and enforce usage limits per plan.
 */
import { readTable, writeTable } from '../auth/db.mjs';
import { getUserById } from '../auth/user-store.mjs';
import { getPlan, isUnlimited } from './plans.mjs';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getUsageKey(userId, action, month) {
  return `${userId}:${action}:${month}`;
}

/**
 * Get usage for a user/action in current month.
 */
function getUsageCount(userId, action) {
  const month = getCurrentMonth();
  const events = readTable('usage_events');
  const entry = events.find(e => e.user_id === userId && e.action === action && e.month === month);
  return entry ? entry.count : 0;
}

/**
 * Check if action is allowed under user's plan.
 * Returns { allowed, remaining, limit }
 */
export function checkQuota(userId, action) {
  const user = getUserById(userId);
  if (!user) return { allowed: false, remaining: 0, limit: 0 };

  const plan = getPlan(user.plan);
  let limit;
  switch (action) {
    case 'compile':      limit = plan.compilationsPerMonth; break;
    case 'agent_hire':   limit = plan.agentsMax; break;
    default:             return { allowed: true, remaining: -1, limit: -1 };
  }

  if (isUnlimited(limit)) return { allowed: true, remaining: -1, limit: -1 };

  const used = action === 'agent_hire' ? getActiveAgentCount(userId) : getUsageCount(userId, action);
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, remaining, limit };
}

function getActiveAgentCount(userId) {
  // Count agents hired by user from marketplace
  const events = readTable('usage_events');
  const entry = events.find(e => e.user_id === userId && e.action === 'agent_hire' && e.month === 'total');
  return entry ? entry.count : 0;
}

/**
 * Increment usage for user/action.
 */
export function incrementUsage(userId, action) {
  const month = getCurrentMonth();
  const events = readTable('usage_events');
  const idx = events.findIndex(e => e.user_id === userId && e.action === action && e.month === month);
  if (idx >= 0) {
    events[idx].count++;
    events[idx].updated_at = new Date().toISOString();
  } else {
    events.push({ user_id: userId, action, count: 1, month, updated_at: new Date().toISOString() });
  }
  writeTable('usage_events', events);
}

/**
 * Get usage summary for current month.
 */
export function getUsageSummary(userId) {
  const month = getCurrentMonth();
  const events = readTable('usage_events');
  const userEvents = events.filter(e => e.user_id === userId && e.month === month);

  const summary = { compilations: 0, agentHires: 0 };
  for (const e of userEvents) {
    if (e.action === 'compile') summary.compilations = e.count;
    if (e.action === 'agent_hire') summary.agentHires = e.count;
  }
  return summary;
}
