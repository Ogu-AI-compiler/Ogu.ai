/**
 * Override Audit Log — formal override records with authority validation.
 *
 * Tracks every override with who, why, and under what authority.
 * Supports filtering by authority and role-based validation.
 */

let nextId = 1;

/**
 * Create an override audit log.
 *
 * @param {object} [opts] - { authorizedRoles: { authority: string[] } }
 * @returns {object} Log with recordOverride/getOverrides/getOverridesByAuthority/validateAuthority
 */
export function createOverrideAuditLog(opts = {}) {
  const records = [];
  const authorizedRoles = opts.authorizedRoles || {};

  function recordOverride({ gateId, overriddenBy, reason, authority }) {
    const entry = {
      id: `override-${nextId++}`,
      gateId,
      overriddenBy,
      reason,
      authority,
      timestamp: Date.now(),
    };
    records.push(entry);
    return entry;
  }

  function getOverrides() {
    return [...records];
  }

  function getOverridesByAuthority(authority) {
    return records.filter(r => r.authority === authority);
  }

  function validateAuthority(role, authority) {
    const allowed = authorizedRoles[authority];
    if (!allowed) return false;
    return allowed.includes(role);
  }

  return { recordOverride, getOverrides, getOverridesByAuthority, validateAuthority };
}
