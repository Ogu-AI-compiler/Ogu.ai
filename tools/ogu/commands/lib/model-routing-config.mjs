import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Model Routing Config — routing policies and decision logging.
 *
 * Manages model selection strategies and logs all routing decisions
 * for audit and optimization purposes.
 */

/**
 * Built-in routing strategies.
 */
export const ROUTING_STRATEGIES = {
  'cost-optimized': {
    description: 'Minimize cost — prefer cheaper models when capability allows',
    preferOrder: ['small', 'medium', 'large'],
    escalateOnFailure: true,
  },
  'quality-first': {
    description: 'Maximize quality — prefer most capable model',
    preferOrder: ['large', 'medium', 'small'],
    escalateOnFailure: false,
  },
  'balanced': {
    description: 'Balance cost and quality — match model tier to task complexity',
    preferOrder: ['medium', 'large', 'small'],
    escalateOnFailure: true,
  },
};

/**
 * Create or update the routing config file.
 */
export function createRoutingConfig({ root, strategy, overrides } = {}) {
  root = root || repoRoot();

  const config = {
    strategy: strategy || 'balanced',
    overrides: overrides || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(join(root, '.ogu/model-config.json'), JSON.stringify(config, null, 2));
  return config;
}

/**
 * Load the routing config.
 */
export function loadRoutingConfig({ root } = {}) {
  root = root || repoRoot();
  const p = join(root, '.ogu/model-config.json');
  if (!existsSync(p)) return { strategy: 'balanced', overrides: {} };
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Log a routing decision to the append-only decision log.
 */
export function logDecision({ root, taskId, roleId, selectedModel, reason, alternatives } = {}) {
  root = root || repoRoot();
  const logPath = join(root, '.ogu/model-log.jsonl');

  const entry = {
    timestamp: new Date().toISOString(),
    taskId,
    roleId,
    selectedModel,
    reason: reason || '',
    alternatives: alternatives || [],
  };

  appendFileSync(logPath, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Get routing decision statistics from the log.
 */
export function getDecisionStats({ root } = {}) {
  root = root || repoRoot();
  const logPath = join(root, '.ogu/model-log.jsonl');

  if (!existsSync(logPath)) {
    return { totalDecisions: 0, modelCounts: {}, roleCounts: {} };
  }

  const lines = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  const modelCounts = {};
  const roleCounts = {};

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      modelCounts[entry.selectedModel] = (modelCounts[entry.selectedModel] || 0) + 1;
      roleCounts[entry.roleId] = (roleCounts[entry.roleId] || 0) + 1;
    } catch { /* skip bad lines */ }
  }

  return {
    totalDecisions: lines.length,
    modelCounts,
    roleCounts,
  };
}
