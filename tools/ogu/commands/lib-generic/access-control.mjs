/**
 * Access Control — enforce access decisions at runtime.
 *
 * Policy-based access control with glob matching, deny-overrides,
 * and audit logging.
 */

/**
 * Simple glob match: "src/*" matches "src/app.ts", "src/lib/x.ts".
 */
function globMatch(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  return pattern === value;
}

/**
 * Create an access controller.
 *
 * @returns {object} Controller with addPolicy/enforce/getAuditLog
 */
export function createAccessControl() {
  const policies = [];
  const auditLog = [];

  function addPolicy({ role, resource, action, effect }) {
    policies.push({ role, resource, action, effect });
  }

  function enforce({ role, resource, action }) {
    const matching = policies.filter(p =>
      p.role === role &&
      p.action === action &&
      globMatch(p.resource, resource)
    );

    // Deny overrides allow
    const hasDeny = matching.some(p => p.effect === 'deny');
    const hasAllow = matching.some(p => p.effect === 'allow');
    const allowed = hasAllow && !hasDeny;

    const decision = {
      allowed,
      role,
      resource,
      action,
      matchedPolicies: matching.length,
      timestamp: Date.now(),
    };

    auditLog.push(decision);
    return decision;
  }

  function getAuditLog() {
    return [...auditLog];
  }

  return { addPolicy, enforce, getAuditLog };
}
