import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Default Roles — 10 pre-built roles for OrgSpec.
 *
 * Each role has capabilities, department, model policy,
 * escalation path, memory scope, and ownership scope.
 */

export const DEFAULT_ROLES = [
  {
    id: 'developer',
    name: 'Developer',
    department: 'engineering',
    capabilities: ['code', 'test', 'debug', 'refactor'],
    modelPolicy: { default: 'claude-sonnet', escalation: 'claude-opus' },
    escalationPath: ['architect', 'cto'],
    memoryScope: 'feature',
    ownershipScope: ['src/', 'lib/', 'packages/'],
    phases: ['build', 'verify'],
    riskTier: 'low',
    networkAccess: 'restricted',
  },
  {
    id: 'architect',
    name: 'Architect',
    department: 'engineering',
    capabilities: ['design', 'code', 'review', 'adr'],
    modelPolicy: { default: 'claude-opus', escalation: 'claude-opus' },
    escalationPath: ['cto'],
    memoryScope: 'project',
    ownershipScope: ['docs/vault/01_Architecture/', 'src/'],
    phases: ['architect', 'build'],
    riskTier: 'medium',
    networkAccess: 'restricted',
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    department: 'engineering',
    capabilities: ['review', 'approve', 'reject'],
    modelPolicy: { default: 'claude-opus', escalation: 'claude-opus' },
    escalationPath: ['architect', 'cto'],
    memoryScope: 'project',
    ownershipScope: [],
    phases: ['verify'],
    riskTier: 'low',
    networkAccess: 'none',
  },
  {
    id: 'tester',
    name: 'QA Tester',
    department: 'engineering',
    capabilities: ['test', 'smoke', 'verify-ui', 'vision'],
    modelPolicy: { default: 'claude-sonnet', escalation: 'claude-opus' },
    escalationPath: ['developer', 'architect'],
    memoryScope: 'feature',
    ownershipScope: ['tests/', 'e2e/'],
    phases: ['verify', 'smoke'],
    riskTier: 'low',
    networkAccess: 'restricted',
  },
  {
    id: 'designer',
    name: 'Designer',
    department: 'design',
    capabilities: ['design', 'brand', 'theme', 'vision'],
    modelPolicy: { default: 'claude-sonnet', escalation: 'claude-opus' },
    escalationPath: ['architect'],
    memoryScope: 'project',
    ownershipScope: ['src/components/', 'src/styles/', 'public/'],
    phases: ['design'],
    riskTier: 'low',
    networkAccess: 'restricted',
  },
  {
    id: 'pm',
    name: 'Product Manager',
    department: 'product',
    capabilities: ['spec', 'prd', 'feature', 'prioritize'],
    modelPolicy: { default: 'claude-opus', escalation: 'claude-opus' },
    escalationPath: ['cto'],
    memoryScope: 'project',
    ownershipScope: ['docs/vault/04_Features/'],
    phases: ['idea', 'feature', 'architect'],
    riskTier: 'low',
    networkAccess: 'none',
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    department: 'infrastructure',
    capabilities: ['deploy', 'monitor', 'configure', 'observe'],
    modelPolicy: { default: 'claude-sonnet', escalation: 'claude-opus' },
    escalationPath: ['cto'],
    memoryScope: 'project',
    ownershipScope: ['infra/', 'docker/', '.github/'],
    phases: ['preview', 'observe'],
    riskTier: 'high',
    networkAccess: 'full',
  },
  {
    id: 'security',
    name: 'Security Auditor',
    department: 'security',
    capabilities: ['review', 'audit', 'scan', 'approve'],
    modelPolicy: { default: 'claude-opus', escalation: 'claude-opus' },
    escalationPath: ['cto'],
    memoryScope: 'project',
    ownershipScope: [],
    phases: ['verify', 'enforce'],
    riskTier: 'medium',
    networkAccess: 'none',
  },
  {
    id: 'cto',
    name: 'CTO',
    department: 'executive',
    capabilities: ['override', 'approve', 'reject', 'escalate', 'freeze'],
    modelPolicy: { default: 'claude-opus', escalation: 'claude-opus' },
    escalationPath: [],
    memoryScope: 'global',
    ownershipScope: [],
    phases: [],
    riskTier: 'critical',
    networkAccess: 'full',
  },
  {
    id: 'documentation',
    name: 'Technical Writer',
    department: 'product',
    capabilities: ['document', 'spec', 'contract'],
    modelPolicy: { default: 'claude-sonnet', escalation: 'claude-sonnet' },
    escalationPath: ['pm', 'architect'],
    memoryScope: 'project',
    ownershipScope: ['docs/'],
    phases: ['feature', 'architect'],
    riskTier: 'low',
    networkAccess: 'none',
  },
];

/**
 * Apply default roles to OrgSpec.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {boolean} [opts.overwrite] - Overwrite existing roles
 * @returns {{ added: number }}
 */
export function applyDefaultRoles({ root, overwrite } = {}) {
  root = root || repoRoot();
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) return { added: 0 };

  const org = JSON.parse(readFileSync(orgPath, 'utf8'));
  const existingIds = new Set((org.roles || []).map(r => r.id));
  let added = 0;

  for (const role of DEFAULT_ROLES) {
    if (overwrite || !existingIds.has(role.id)) {
      if (existingIds.has(role.id)) {
        const idx = org.roles.findIndex(r => r.id === role.id);
        org.roles[idx] = role;
      } else {
        org.roles.push(role);
      }
      added++;
    }
  }

  writeFileSync(orgPath, JSON.stringify(org, null, 2));
  return { added };
}
