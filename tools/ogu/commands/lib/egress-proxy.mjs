/**
 * Egress Proxy — network egress filtering for sandboxed agents.
 *
 * Controls which network requests agents can make based on sandbox policy.
 * Part of Fix 8 (Sandbox Policy Spec) and Closure 12 (MicroVM Execution).
 *
 * Functions:
 *   createEgressProxy(policy)   — Create an egress filter for a sandbox policy
 *   checkEgress(url, policy)    — Check if a URL is allowed by policy
 *   logEgressAttempt(...)       — Log an egress attempt (allowed or blocked)
 *   getEgressLog(root, taskId)  — Get egress log for a task
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { emitAudit } from './audit-emitter.mjs';

const EGRESS_LOG_DIR = '.ogu/egress';

/**
 * Check if a URL is allowed by the sandbox network policy.
 *
 * @param {string} url — URL to check
 * @param {object} policy — sandbox policy
 * @param {string} policy.networkAccess — 'none' | 'allowlist' | 'allow'
 * @param {string[]} [policy.networkAllowlist] — allowed domains/URLs
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkEgress(url, policy) {
  if (!policy) return { allowed: false, reason: 'No policy provided' };

  const networkAccess = policy.networkAccess || 'none';

  // No network access
  if (networkAccess === 'none' || networkAccess === 'deny') {
    return { allowed: false, reason: `Network access denied (policy: ${networkAccess})` };
  }

  // Full access
  if (networkAccess === 'allow' || networkAccess === 'full') {
    return { allowed: true, reason: 'Full network access allowed' };
  }

  // Allowlist mode
  if (networkAccess === 'allowlist' || networkAccess === 'localhost') {
    const allowlist = policy.networkAllowlist || [];

    // localhost is always allowed in allowlist mode
    if (networkAccess === 'localhost') {
      try {
        const parsed = new URL(url);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === '[::1]') {
          return { allowed: true, reason: 'localhost access allowed' };
        }
      } catch {
        return { allowed: false, reason: 'Invalid URL' };
      }
    }

    // Check allowlist
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      for (const entry of allowlist) {
        // Exact match
        if (entry === hostname) return { allowed: true, reason: `Matched allowlist: ${entry}` };
        // Wildcard subdomain match (*.example.com)
        if (entry.startsWith('*.') && hostname.endsWith(entry.slice(1))) {
          return { allowed: true, reason: `Matched wildcard: ${entry}` };
        }
        // URL prefix match
        if (url.startsWith(entry)) return { allowed: true, reason: `Matched URL prefix: ${entry}` };
      }
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }

    return { allowed: false, reason: `URL not in allowlist (${allowlist.length} entries)` };
  }

  return { allowed: false, reason: `Unknown network policy: ${networkAccess}` };
}

/**
 * Create an egress proxy function for a sandbox policy.
 *
 * @param {object} policy — sandbox policy with networkAccess and networkAllowlist
 * @param {object} [context] — { taskId, featureSlug, roleId, root }
 * @returns {function(string): { allowed: boolean, reason: string }}
 */
export function createEgressProxy(policy, context = {}) {
  return function proxyCheck(url) {
    const result = checkEgress(url, policy);

    // Log the attempt
    if (context.root) {
      logEgressAttempt(context.root, {
        url,
        allowed: result.allowed,
        reason: result.reason,
        taskId: context.taskId,
        featureSlug: context.featureSlug,
        roleId: context.roleId,
      });
    }

    // Audit blocked attempts
    if (!result.allowed) {
      emitAudit('egress.blocked', {
        url,
        reason: result.reason,
        taskId: context.taskId,
        featureSlug: context.featureSlug,
        roleId: context.roleId,
      });
    }

    return result;
  };
}

/**
 * Log an egress attempt to the per-task egress log.
 *
 * @param {string} root — repo root
 * @param {object} entry — { url, allowed, reason, taskId, featureSlug, roleId }
 */
export function logEgressAttempt(root, entry) {
  const dir = join(root, EGRESS_LOG_DIR);
  mkdirSync(dir, { recursive: true });

  const record = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const logFile = entry.taskId ? `${entry.taskId}.jsonl` : 'general.jsonl';
  appendFileSync(join(dir, logFile), JSON.stringify(record) + '\n', 'utf8');
}

/**
 * Get egress log for a task.
 *
 * @param {string} root — repo root
 * @param {string} taskId — task ID
 * @returns {object[]} — array of egress log entries
 */
export function getEgressLog(root, taskId) {
  const logPath = join(root, EGRESS_LOG_DIR, `${taskId}.jsonl`);
  if (!existsSync(logPath)) return [];

  return readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}
