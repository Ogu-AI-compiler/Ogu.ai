import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Capability Registry — role → capability → model routing chain.
 *
 * Three-layer routing: Role → Capability → Model
 * Separates organizational concerns (roles) from technical concerns (model traits).
 */

const CAPABILITIES_PATH = '.ogu/capabilities.json';

const DEFAULT_CAPABILITIES = {
  $schema: 'CapabilityRegistry/1.0',
  capabilities: [
    { id: 'architect_review', name: 'Architecture Review', category: 'review', requiredTraits: ['reasoning', 'code_understanding', 'long_context'], minTier: 2, preferredTier: 3 },
    { id: 'code_generation', name: 'Code Generation', category: 'generation', requiredTraits: ['coding', 'tool_use', 'instruction_following'], minTier: 2, preferredTier: 2 },
    { id: 'code_refactor', name: 'Code Refactoring', category: 'generation', requiredTraits: ['coding', 'code_understanding', 'reasoning'], minTier: 2, preferredTier: 3 },
    { id: 'security_audit', name: 'Security Audit', category: 'analysis', requiredTraits: ['reasoning', 'code_understanding', 'security_knowledge'], minTier: 3, preferredTier: 3 },
    { id: 'test_generation', name: 'Test Generation', category: 'generation', requiredTraits: ['coding', 'test_reasoning'], minTier: 1, preferredTier: 2 },
    { id: 'static_analysis', name: 'Static Analysis', category: 'analysis', requiredTraits: ['code_understanding'], minTier: 1, preferredTier: 1 },
    { id: 'spec_writing', name: 'Specification Writing', category: 'documentation', requiredTraits: ['reasoning', 'instruction_following', 'long_context'], minTier: 2, preferredTier: 2 },
    { id: 'design_review', name: 'Design Review', category: 'review', requiredTraits: ['vision', 'design_knowledge'], minTier: 2, preferredTier: 3 },
  ],
  providerCapabilities: {
    anthropic: {
      'claude-haiku-4-5': {
        tier: 1,
        traits: ['coding', 'instruction_following', 'code_understanding'],
        costFactor: 1.0,
      },
      'claude-sonnet-4-6': {
        tier: 2,
        traits: ['coding', 'reasoning', 'code_understanding', 'tool_use', 'instruction_following', 'test_reasoning', 'long_context'],
        costFactor: 3.0,
      },
      'claude-opus-4-6': {
        tier: 3,
        traits: ['coding', 'reasoning', 'code_understanding', 'tool_use', 'instruction_following', 'security_knowledge', 'design_knowledge', 'long_context', 'vision', 'test_reasoning'],
        costFactor: 15.0,
      },
    },
  },
  roleCapabilityMap: {
    'pm': ['spec_writing'],
    'architect': ['architect_review', 'spec_writing'],
    'designer': ['design_review'],
    'backend-dev': ['code_generation', 'code_refactor', 'test_generation'],
    'frontend-dev': ['code_generation', 'code_refactor', 'test_generation', 'design_review'],
    'qa': ['test_generation', 'static_analysis'],
    'security': ['security_audit', 'static_analysis'],
    'devops': ['code_generation', 'static_analysis'],
    'tech-lead': ['architect_review', 'code_refactor', 'security_audit'],
  },
};

function loadCapabilities(root) {
  root = root || repoRoot();
  const capPath = join(root, CAPABILITIES_PATH);
  if (existsSync(capPath)) {
    try { return JSON.parse(readFileSync(capPath, 'utf8')); } catch { /* fall through */ }
  }
  return DEFAULT_CAPABILITIES;
}

function saveCapabilities(root, caps) {
  root = root || repoRoot();
  mkdirSync(join(root, '.ogu'), { recursive: true });
  writeFileSync(join(root, CAPABILITIES_PATH), JSON.stringify(caps, null, 2));
}

function loadOrg(root) {
  root = root || repoRoot();
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) return null;
  try { return JSON.parse(readFileSync(orgPath, 'utf8')); } catch { return null; }
}

/**
 * Ensure capabilities.json exists.
 */
export function ensureCapabilities(root) {
  root = root || repoRoot();
  const capPath = join(root, CAPABILITIES_PATH);
  if (!existsSync(capPath)) {
    saveCapabilities(root, DEFAULT_CAPABILITIES);
  }
  return loadCapabilities(root);
}

/**
 * Resolve the best model for a role + capability combination.
 *
 * @param {string} root
 * @param {object} opts
 * @param {string} opts.roleId
 * @param {string} opts.capabilityId
 * @param {number} [opts.budgetTier=3]
 * @param {string} [opts.preferredProvider]
 * @returns {{ resolved: boolean, provider?: string, model?: string, tier?: number, partial?: boolean, missingTraits?: string[], error?: string, recommendation?: string }}
 */
export function resolveCapability(root, { roleId, capabilityId, budgetTier = 3, preferredProvider } = {}) {
  const registry = loadCapabilities(root);

  const capability = registry.capabilities.find(c => c.id === capabilityId);
  if (!capability) return { resolved: false, error: `OGU3001: Unknown capability: ${capabilityId}` };

  // Validate role has this capability
  const roleCapabilities = registry.roleCapabilityMap[roleId] || [];
  if (!roleCapabilities.includes(capabilityId)) {
    return { resolved: false, error: `OGU3002: Role '${roleId}' does not have capability '${capabilityId}'` };
  }

  const targetTier = Math.min(capability.preferredTier, budgetTier);
  if (targetTier < capability.minTier) {
    return {
      resolved: false,
      error: `OGU3003: Capability '${capabilityId}' requires min tier ${capability.minTier}, but budget allows tier ${targetTier}`,
      recommendation: 'escalate_budget',
    };
  }

  // Find best model across providers
  const candidates = [];
  for (const [providerId, models] of Object.entries(registry.providerCapabilities)) {
    if (preferredProvider && providerId !== preferredProvider) continue;
    for (const [modelId, modelDef] of Object.entries(models)) {
      if (modelDef.tier > targetTier || modelDef.tier < capability.minTier) continue;
      const missingTraits = capability.requiredTraits.filter(t => !modelDef.traits.includes(t));
      candidates.push({
        providerId, modelId, tier: modelDef.tier,
        costFactor: modelDef.costFactor,
        traitCoverage: 1 - (missingTraits.length / capability.requiredTraits.length),
        missingTraits,
      });
    }
  }

  if (candidates.length === 0) {
    return { resolved: false, error: `OGU3004: No model for capability '${capabilityId}' at tier <= ${targetTier}`, recommendation: 'escalate_budget_or_change_provider' };
  }

  candidates.sort((a, b) => {
    if (a.traitCoverage !== b.traitCoverage) return b.traitCoverage - a.traitCoverage;
    if (a.tier !== b.tier) return b.tier - a.tier;
    return a.costFactor - b.costFactor;
  });

  const winner = candidates[0];
  return {
    resolved: true,
    partial: winner.traitCoverage < 1.0,
    provider: winner.providerId,
    model: winner.modelId,
    tier: winner.tier,
    costFactor: winner.costFactor,
    missingTraits: winner.missingTraits.length > 0 ? winner.missingTraits : undefined,
    warning: winner.traitCoverage < 1.0
      ? `Model '${winner.modelId}' missing traits: ${winner.missingTraits.join(', ')}`
      : undefined,
  };
}

/**
 * Detect which capability a task requires.
 */
export function detectCapability(task, phase) {
  if (phase === 'architect') return 'architect_review';
  if (phase === 'design') return 'design_review';
  const group = (task?.group || '').toLowerCase();
  const outputs = task?.outputs || [];
  if (outputs.some(o => o.startsWith('TEST:'))) return 'test_generation';
  if (group.includes('security') || group.includes('audit')) return 'security_audit';
  if (group.includes('refactor')) return 'code_refactor';
  if (group.includes('spec') || group.includes('prd')) return 'spec_writing';
  return 'code_generation';
}

/**
 * Get all capabilities a specific model can handle.
 */
export function modelCapabilities(root, providerId, modelId) {
  const registry = loadCapabilities(root);
  const modelDef = registry.providerCapabilities[providerId]?.[modelId];
  if (!modelDef) return [];
  return registry.capabilities.filter(cap =>
    cap.requiredTraits.every(trait => modelDef.traits.includes(trait)) && modelDef.tier >= cap.minTier
  ).map(cap => cap.id);
}

/**
 * List all unique capabilities across all roles.
 */
export function listCapabilities({ root } = {}) {
  const registry = loadCapabilities(root);
  return registry.capabilities.map(c => ({
    id: c.id, name: c.name, category: c.category, minTier: c.minTier, preferredTier: c.preferredTier,
  }));
}

/**
 * Legacy: resolve chain from OrgSpec roles (backwards compatible).
 */
export function resolveChain({ capability, riskTier, root } = {}) {
  const org = loadOrg(root);
  if (!org) return null;
  const roles = (org.roles || []).filter(r => r.enabled !== false);
  let candidates = roles.filter(r => (r.capabilities || []).includes(capability));
  if (candidates.length === 0) return null;

  const RISK_ORDER = { standard: 0, low: 0, elevated: 1, medium: 1, critical: 2, high: 2 };
  if (riskTier) {
    const minRisk = RISK_ORDER[riskTier] || 0;
    const filtered = candidates.filter(r => (RISK_ORDER[r.riskTier] || 0) >= minRisk);
    if (filtered.length > 0) candidates = filtered;
  }
  candidates.sort((a, b) => (RISK_ORDER[a.riskTier] || 0) - (RISK_ORDER[b.riskTier] || 0));

  const chosen = candidates[0];
  const modelPolicy = chosen.modelPolicy || {};
  return {
    roleId: chosen.roleId || chosen.id,
    roleName: chosen.name,
    capability,
    model: modelPolicy.default || 'claude-sonnet-4-6',
    riskTier: chosen.riskTier,
    escalation: modelPolicy.escalationChain || [],
  };
}

/**
 * Legacy: get escalation chain.
 */
export function getEscalationChain({ roleId, root } = {}) {
  const org = loadOrg(root);
  if (!org) return null;
  const role = (org.roles || []).find(r => (r.roleId || r.id) === roleId);
  if (!role) return null;
  const modelPolicy = role.modelPolicy || {};
  return {
    roleId: role.roleId || role.id,
    defaultModel: modelPolicy.default || 'claude-sonnet-4-6',
    escalation: modelPolicy.escalationChain || [],
  };
}
