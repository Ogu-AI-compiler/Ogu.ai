import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Override Handler — formal override records with authority validation.
 *
 * Overrides allow authorized roles to bypass gates, policies, or constraints.
 * Every override is recorded with reason, authority, and expiry.
 * Stored in .ogu/overrides/{id}.json
 */

/**
 * Override types and permission matrix.
 */
const OVERRIDE_PERMISSIONS = {
  validation_skip: { allowedRoles: ['tech-lead', 'cto'], requiresADR: false, maxDuration: '24h', auditLevel: 'warning' },
  gate_skip: { allowedRoles: ['cto'], requiresADR: true, maxDuration: 'permanent', auditLevel: 'critical' },
  model_force: { allowedRoles: ['tech-lead', 'architect', 'cto'], requiresADR: false, maxDuration: 'session', auditLevel: 'info' },
  budget_extend: { allowedRoles: ['tech-lead', 'cto'], requiresADR: false, maxDuration: '24h', auditLevel: 'warning' },
  governance_bypass: { allowedRoles: ['cto'], requiresADR: true, maxDuration: 'permanent', auditLevel: 'critical' },
  state_force: { allowedRoles: ['cto'], requiresADR: true, maxDuration: 'permanent', auditLevel: 'critical' },
  spec_deviation: { allowedRoles: ['architect', 'cto'], requiresADR: true, maxDuration: 'permanent', auditLevel: 'warning' },
};

const IMPACT_MAP = {
  validation_skip: { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] },
  gate_skip: { determinismBroken: true, gatesSkipped: ['target'], invariantsViolated: [] },
  model_force: { determinismBroken: true, gatesSkipped: [], invariantsViolated: [] },
  budget_extend: { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] },
  governance_bypass: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['governance_policy'] },
  state_force: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['state_machine'] },
  spec_deviation: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['spec_contract'] },
};

/**
 * Check if a role can create an override of a given type.
 */
function canOverride(roleId, root, overrideType) {
  // If override type specified, use permission matrix
  if (overrideType && OVERRIDE_PERMISSIONS[overrideType]) {
    return OVERRIDE_PERMISSIONS[overrideType].allowedRoles.includes(roleId);
  }

  // Legacy: check OrgSpec capabilities
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) return false;
  const org = JSON.parse(readFileSync(orgPath, 'utf8'));
  const role = (org.roles || []).find(r => r.roleId === roleId || r.id === roleId);
  if (!role || role.enabled === false) return false;
  return (role.capabilities || []).includes('override') ||
    roleId === 'cto' || roleId === 'tech-lead';
}

function calculateExpiry(maxDuration) {
  if (maxDuration === 'permanent' || maxDuration === 'session') return null;
  const hours = parseInt(maxDuration);
  if (isNaN(hours)) return new Date(Date.now() + 24 * 3600000).toISOString();
  return new Date(Date.now() + hours * 3600000).toISOString();
}

/**
 * Create an override record.
 *
 * @param {object} opts
 * @param {string} opts.target - What is being overridden (e.g. "gate:3", "policy:deploy")
 * @param {string} opts.reason - Why the override is needed
 * @param {string} opts.authority - Role ID of the override creator
 * @param {string} opts.featureSlug - Feature context
 * @param {string} [opts.root]
 * @param {number} [opts.expiresInMs] - Override expiry in ms (default: 24h)
 * @returns {{ id, target, reason, authority, featureSlug, status, createdAt, expiresAt }}
 */
export function createOverride({ target, reason, authority, featureSlug, root, expiresInMs, type, adrReference, taskId, gate } = {}) {
  root = root || repoRoot();

  // Determine override type (new path) or legacy
  const overrideType = type || null;

  if (!canOverride(authority, root, overrideType)) {
    const allowed = overrideType && OVERRIDE_PERMISSIONS[overrideType]
      ? OVERRIDE_PERMISSIONS[overrideType].allowedRoles.join(', ')
      : 'tech-lead, cto';
    throw new Error(`OGU2952: Role "${authority}" not authorized for "${overrideType || 'override'}". Allowed: ${allowed}`);
  }

  // Check ADR requirement for typed overrides
  const perm = OVERRIDE_PERMISSIONS[overrideType];
  if (perm?.requiresADR && !adrReference) {
    throw new Error(`OGU2953: Override type "${overrideType}" requires ADR reference`);
  }
  if (!reason) {
    throw new Error(`OGU2954: Override requires a reason`);
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = expiresInMs
    ? new Date(Date.now() + expiresInMs).toISOString()
    : (perm ? calculateExpiry(perm.maxDuration) : new Date(Date.now() + 24 * 3600000).toISOString());

  // Assess impact
  const impact = overrideType && IMPACT_MAP[overrideType]
    ? { ...IMPACT_MAP[overrideType], riskAssessment: 'requires review' }
    : { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] };
  if (impact.gatesSkipped.includes('target') && gate) {
    impact.gatesSkipped = [gate];
  }

  const record = {
    $schema: 'Override/1.0',
    id,
    type: overrideType || 'generic',
    target,
    reason,
    authority: {
      role: authority,
      adrReference: adrReference || null,
    },
    scope: {
      featureSlug: featureSlug || null,
      taskId: taskId || null,
      gate: gate || null,
    },
    impact,
    status: 'active',
    createdAt,
    expiresAt,
    auditLevel: perm?.auditLevel || 'info',
  };

  const dir = join(root, '.ogu/overrides');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(record, null, 2));

  return record;
}

/**
 * Revoke an active override.
 *
 * @param {object} opts
 * @param {string} opts.overrideId
 * @param {string} [opts.root]
 * @returns {object} Updated record
 */
export function revokeOverride({ overrideId, root } = {}) {
  root = root || repoRoot();
  const filePath = join(root, '.ogu/overrides', `${overrideId}.json`);
  if (!existsSync(filePath)) throw new Error(`Override not found: ${overrideId}`);

  const record = JSON.parse(readFileSync(filePath, 'utf8'));
  record.status = 'revoked';
  record.revokedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(record, null, 2));
  return record;
}

/**
 * List all overrides, optionally filtered by status.
 *
 * @param {object} opts
 * @param {string} [opts.status] - Filter by status (active, revoked, expired)
 * @param {string} [opts.root]
 * @returns {object[]}
 */
export function listOverrides({ status, root } = {}) {
  root = root || repoRoot();
  const dir = join(root, '.ogu/overrides');
  if (!existsSync(dir)) return [];

  const records = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const rec = JSON.parse(readFileSync(join(dir, f), 'utf8'));

      // Auto-expire
      if (rec.status === 'active' && new Date(rec.expiresAt) < new Date()) {
        rec.status = 'expired';
        writeFileSync(join(dir, f), JSON.stringify(rec, null, 2));
      }

      if (!status || rec.status === status) {
        records.push(rec);
      }
    } catch { /* skip */ }
  }

  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return records;
}

/**
 * Check if a target has an active override.
 *
 * @param {object} opts
 * @param {string} opts.target
 * @param {string} [opts.root]
 * @returns {object|null}
 */
export function checkOverride({ target, root } = {}) {
  const active = listOverrides({ status: 'active', root });
  return active.find(r => r.target === target) || null;
}

/**
 * Assess the impact of an existing override.
 *
 * Reads the override record, computes impact from IMPACT_MAP,
 * determines affected agents and risk level.
 *
 * @param {string} root
 * @param {string} overrideId
 * @returns {{ scope, affectedAgents, riskLevel, recommendation }}
 */
export function assessOverrideImpact(root, overrideId) {
  root = root || repoRoot();
  const filePath = join(root, '.ogu/overrides', `${overrideId}.json`);
  if (!existsSync(filePath)) {
    return { scope: 'unknown', affectedAgents: [], riskLevel: 'unknown', recommendation: 'Override not found' };
  }

  const record = JSON.parse(readFileSync(filePath, 'utf8'));
  const type = record.type || 'generic';
  const impact = IMPACT_MAP[type] || { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] };

  // Determine scope from override record
  const scope = record.scope?.featureSlug ? 'feature' : 'global';

  // Determine affected agents from OrgSpec
  const affectedAgents = [];
  try {
    const orgPath = join(root, '.ogu/OrgSpec.json');
    if (existsSync(orgPath)) {
      const org = JSON.parse(readFileSync(orgPath, 'utf8'));
      for (const role of (org.roles || [])) {
        if (role.enabled === false) continue;
        // If override is feature-scoped, only agents working on that feature are affected
        // For global overrides, all agents with matching capabilities are affected
        if (scope === 'global' || record.scope?.featureSlug) {
          const perm = OVERRIDE_PERMISSIONS[type];
          if (perm && !perm.allowedRoles.includes(role.roleId)) {
            affectedAgents.push(role.roleId);
          }
        }
      }
    }
  } catch { /* skip */ }

  // Compute risk level
  let riskLevel = 'low';
  if (impact.determinismBroken) riskLevel = 'high';
  if (impact.invariantsViolated.length > 0) riskLevel = 'critical';
  if (impact.gatesSkipped.length > 0 && riskLevel === 'low') riskLevel = 'medium';

  // Generate recommendation
  let recommendation = 'No action needed';
  if (riskLevel === 'critical') {
    recommendation = `Critical override — ${impact.invariantsViolated.join(', ')} violated. Review and revoke when no longer needed.`;
  } else if (riskLevel === 'high') {
    recommendation = 'Determinism broken — results may vary. Monitor closely.';
  } else if (riskLevel === 'medium') {
    recommendation = `Gates skipped: ${impact.gatesSkipped.join(', ')}. Verify manually.`;
  }

  return { scope, affectedAgents, riskLevel, recommendation };
}
