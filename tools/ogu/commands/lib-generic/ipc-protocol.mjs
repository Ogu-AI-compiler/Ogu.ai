import { randomUUID } from 'node:crypto';

/**
 * IPC Command Protocol — formal command/response protocol for inter-process communication.
 *
 * Defines structured command envelopes and response envelopes
 * for communication between CLI, Studio, Kadima daemon, and runners.
 */

/**
 * Valid IPC command actions.
 */
export const COMMAND_ACTIONS = [
  // Task lifecycle
  'task.enqueue',
  'task.cancel',
  'task.retry',
  'task.status',
  // Feature lifecycle
  'feature.create',
  'feature.transition',
  'feature.compile',
  // Agent lifecycle
  'agent.start',
  'agent.stop',
  'agent.status',
  // System
  'status',
  'health',
  'shutdown',
  'freeze',
  'thaw',
  // Budget
  'budget.check',
  'budget.report',
  // Governance
  'governance.check',
  'governance.approve',
  'governance.deny',
];

/**
 * Create a command envelope.
 *
 * @param {object} opts
 * @param {string} opts.action - Command action
 * @param {object} opts.payload - Command data
 * @param {string} opts.sender - Sender identifier (e.g., 'studio', 'cli', 'kadima')
 * @param {string} [opts.replyTo] - Optional reply channel
 * @returns {{ id, action, payload, sender, replyTo, timestamp }}
 */
export function createCommand({ action, payload, sender, replyTo } = {}) {
  return {
    id: randomUUID(),
    action,
    payload: payload || {},
    sender: sender || 'unknown',
    replyTo: replyTo || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a response envelope.
 *
 * @param {object} opts
 * @param {string} opts.commandId - Original command ID
 * @param {string} opts.status - 'ok' | 'error' | 'pending'
 * @param {object} [opts.data] - Response data
 * @param {object} [opts.error] - Error details { code, message }
 * @returns {{ commandId, status, data, error, timestamp }}
 */
export function createResponse({ commandId, status, data, error } = {}) {
  return {
    commandId,
    status: status || 'ok',
    data: data || null,
    error: error || null,
    timestamp: new Date().toISOString(),
  };
}
