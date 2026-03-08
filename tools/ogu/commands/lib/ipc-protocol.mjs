/**
 * ipc-protocol.mjs — Structured IPC command/response envelopes.
 */
import { randomUUID } from 'node:crypto';

export const COMMAND_ACTIONS = {
  DISPATCH_TASK: 'dispatch_task', CANCEL_TASK: 'cancel_task',
  QUERY_STATUS: 'query_status', UPDATE_CONFIG: 'update_config',
  SHUTDOWN: 'shutdown', HEALTH_CHECK: 'health_check',
  LIST_RUNNERS: 'list_runners', FLUSH_QUEUE: 'flush_queue',
};

export function createCommand(action, payload = {}, { correlationId } = {}) {
  return { id: randomUUID(), correlationId: correlationId || randomUUID(), action, payload, timestamp: new Date().toISOString(), version: '1.0' };
}

export function createResponse(commandId, result = null, error = null) {
  return { id: randomUUID(), commandId, success: error === null, result, error: error ? { message: error.message || String(error), code: error.code || 'UNKNOWN' } : null, timestamp: new Date().toISOString(), version: '1.0' };
}
