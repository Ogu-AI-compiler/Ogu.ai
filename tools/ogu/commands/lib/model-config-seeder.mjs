/**
 * Model Config Seeder — generate default model-config.json from OrgSpec roles.
 */

import { DEFAULT_ROLES } from './orgspec-seeder.mjs';

const DEFAULT_MODELS = [
  { id: 'haiku', provider: 'anthropic', costPer1kIn: 0.00025, costPer1kOut: 0.00125, maxTokens: 200000 },
  { id: 'sonnet', provider: 'anthropic', costPer1kIn: 0.003, costPer1kOut: 0.015, maxTokens: 200000 },
  { id: 'opus', provider: 'anthropic', costPer1kIn: 0.015, costPer1kOut: 0.075, maxTokens: 200000 },
];

const DEFAULT_ROLE_ROUTING = {
  pm:             { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
  architect:      { defaultModel: 'opus',   escalationChain: ['opus'] },
  designer:       { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
  'backend-dev':  { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
  'frontend-dev': { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
  qa:             { defaultModel: 'haiku',  escalationChain: ['haiku', 'sonnet'] },
  security:       { defaultModel: 'opus',   escalationChain: ['opus'] },
  devops:         { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
  'tech-lead':    { defaultModel: 'opus',   escalationChain: ['opus'] },
  cto:            { defaultModel: 'opus',   escalationChain: ['opus'] },
};

/**
 * Generate a default model config.
 *
 * @param {{ roles?: Array<{ id: string, modelPolicy: object }> }} opts
 * @returns {object} Model config
 */
export function seedModelConfig({ roles } = {}) {
  const byRole = { ...DEFAULT_ROLE_ROUTING };

  if (roles) {
    for (const role of roles) {
      byRole[role.id] = {
        defaultModel: role.modelPolicy.defaultModel,
        escalationChain: role.modelPolicy.escalationChain,
      };
    }
  }

  return {
    version: '1.0',
    models: DEFAULT_MODELS,
    routing: {
      byRole,
      fallbackModel: 'sonnet',
      escalation: {
        maxFailures: 3,
        cooldownMs: 60000,
      },
    },
    createdAt: new Date().toISOString(),
  };
}
