/**
 * Daemon Client — HTTP client for communicating with Kadima daemon.
 */

import { randomUUID } from 'node:crypto';

/**
 * Build a request envelope for the daemon.
 *
 * @param {string} command
 * @param {object} payload
 * @returns {object}
 */
export function buildRequest(command, payload = {}) {
  return {
    requestId: randomUUID().slice(0, 12),
    command,
    payload,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a response envelope from the daemon.
 *
 * @param {object} envelope
 * @returns {{ status: string, result: any, requestId: string }}
 */
export function parseResponse(envelope) {
  return {
    requestId: envelope.requestId,
    status: envelope.status || 'unknown',
    result: envelope.result || null,
  };
}

/**
 * Create a daemon client.
 *
 * @param {{ host: string, port: number }} opts
 * @returns {object} Client with send/getStatus/isConnected
 */
export function createDaemonClient({ host, port }) {
  let connected = false;

  async function send(command, payload) {
    const req = buildRequest(command, payload);
    // In offline mode, return error
    if (!connected) {
      return { requestId: req.requestId, status: 'error', error: 'Not connected to daemon' };
    }
    // Real implementation would do HTTP fetch here
    return { requestId: req.requestId, status: 'sent' };
  }

  function isConnected() {
    return connected;
  }

  function getStatus() {
    return {
      host,
      port,
      mode: connected ? 'online' : 'offline',
      connected,
    };
  }

  function connect() {
    connected = true;
  }

  function disconnect() {
    connected = false;
  }

  return { send, isConnected, getStatus, connect, disconnect };
}
