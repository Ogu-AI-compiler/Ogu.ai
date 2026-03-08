/**
 * Distributed Runner Protocol — protocol for remote agent execution.
 */

import { randomUUID } from 'node:crypto';

export const PROTOCOL_COMMANDS = ['execute', 'build', 'test', 'lint', 'deploy', 'health', 'cancel'];

/**
 * Create a runner protocol handler.
 *
 * @returns {object} Protocol with encodeRequest/decodeResponse/encodeResponse
 */
export function createRunnerProtocol() {
  function encodeRequest({ taskId, agentId, command, args = {} }) {
    return {
      id: randomUUID().slice(0, 12),
      version: 1,
      type: 'request',
      taskId,
      agentId,
      command,
      args,
      timestamp: new Date().toISOString(),
    };
  }

  function decodeResponse(raw) {
    return {
      id: raw.id,
      version: raw.version || 1,
      status: raw.status,
      result: raw.result || null,
      metrics: raw.metrics || {},
      error: raw.error || null,
    };
  }

  function encodeResponse({ requestId, status, result, metrics, error }) {
    return {
      id: randomUUID().slice(0, 12),
      version: 1,
      type: 'response',
      requestId,
      status,
      result,
      metrics,
      error,
      timestamp: new Date().toISOString(),
    };
  }

  return { encodeRequest, decodeResponse, encodeResponse };
}
