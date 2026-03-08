/**
 * Access Control List — resource-based access control with deny-overrides.
 */

/**
 * Simple glob match: * matches any sequence of chars.
 */
function globMatch(pattern, str) {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(str);
}

/**
 * Create an ACL instance.
 * @returns {object} ACL with allow/deny/isAllowed/listRules
 */
export function createACL() {
  const rules = []; // { type: 'allow'|'deny', role, resource, action }

  function allow(role, resource, action) {
    rules.push({ type: 'allow', role, resource, action });
  }

  function deny(role, resource, action) {
    rules.push({ type: 'deny', role, resource, action });
  }

  function isAllowed(role, resource, action) {
    let allowed = false;

    for (const rule of rules) {
      if (rule.role !== role) continue;
      if (rule.action !== action) continue;
      if (!globMatch(rule.resource, resource)) continue;

      if (rule.type === 'deny') return false; // Deny overrides
      if (rule.type === 'allow') allowed = true;
    }

    return allowed;
  }

  function listRules() {
    return [...rules];
  }

  return { allow, deny, isAllowed, listRules };
}
