/**
 * Isolation Manager — determines task isolation level based on risk and file paths.
 *
 * Isolation Levels:
 *   L0 — No isolation (shared workspace, fast)
 *   L1 — Git branch isolation (feature branch, auto-merge)
 *   L2 — Git worktree isolation (separate working directory)
 *   L3 — Container isolation (Docker/sandbox, full isolation)
 */

export const ISOLATION_LEVELS = {
  L0: { level: 'L0', name: 'Shared', description: 'No isolation — direct writes to workspace', mergeStrategy: 'direct' },
  L1: { level: 'L1', name: 'Branch', description: 'Git branch — auto-merge on success', mergeStrategy: 'auto-merge' },
  L2: { level: 'L2', name: 'Worktree', description: 'Git worktree — separate working directory', mergeStrategy: 'pr-merge' },
  L3: { level: 'L3', name: 'Container', description: 'Container sandbox — full filesystem isolation', mergeStrategy: 'artifact-copy' },
};

const SENSITIVE_PATTERNS = [
  '.env', '.env.*', 'secrets/**', '*.pem', '*.key', '*.p12',
  '.ogu/audit/**', '.ogu/budget/**', 'production/**', 'deploy/**',
];

const RISK_TO_LEVEL = {
  low: 'L0',
  medium: 'L0',
  high: 'L1',
  critical: 'L2',
};

/**
 * Resolve the isolation level for a task.
 *
 * @param {object} options
 * @param {string} options.riskTier — Task risk tier
 * @param {string[]} [options.touches] — File paths the task will touch
 * @param {string} [options.override] — Force a specific level
 * @returns {{ level: string, reason: string }}
 */
export function resolveIsolation({ riskTier, touches = [], override }) {
  if (override && ISOLATION_LEVELS[override]) {
    return { level: override, reason: `Explicit override to ${override}` };
  }

  let level = RISK_TO_LEVEL[riskTier] || 'L0';

  // Escalate if touching sensitive paths
  const touchesSensitive = touches.some(filePath =>
    SENSITIVE_PATTERNS.some(pattern => {
      if (pattern.startsWith('*.')) {
        // Extension match: *.pem, *.key, etc.
        return filePath.endsWith(pattern.slice(1));
      }
      if (pattern.endsWith('/**')) {
        // Directory match: secrets/**, .ogu/audit/**, etc.
        return filePath.startsWith(pattern.slice(0, -3) + '/') || filePath === pattern.slice(0, -3);
      }
      if (pattern.includes('*')) {
        // Prefix glob: .env.*
        const prefix = pattern.split('*')[0];
        return prefix.length > 0 && filePath.startsWith(prefix);
      }
      return filePath === pattern;
    })
  );

  if (touchesSensitive) {
    // Escalate by at least one level
    const levels = ['L0', 'L1', 'L2', 'L3'];
    const currentIdx = levels.indexOf(level);
    const newIdx = Math.min(currentIdx + 1, levels.length - 1);
    level = levels[newIdx];
  }

  return {
    level,
    reason: touchesSensitive
      ? `Risk tier "${riskTier}" + sensitive file paths → ${level}`
      : `Risk tier "${riskTier}" → ${level}`,
  };
}

/**
 * Get human-readable description of an isolation level.
 *
 * @param {string} level — L0, L1, L2, or L3
 * @returns {object} Level description
 */
export function describeLevel(level) {
  return ISOLATION_LEVELS[level] || { level, name: 'Unknown', description: 'Unknown isolation level', mergeStrategy: 'unknown' };
}
