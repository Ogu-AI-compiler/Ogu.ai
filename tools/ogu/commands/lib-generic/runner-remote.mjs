/**
 * Runner Remote — remote runner via HTTP protocol.
 */

export const REMOTE_PROTOCOLS = ['http', 'https', 'ssh', 'grpc'];

/**
 * Build an execute payload for remote execution.
 *
 * @param {{ taskId: string, command: string, args?: string[] }} opts
 * @returns {object}
 */
export function buildExecutePayload({ taskId, command, args = [] }) {
  return {
    taskId,
    command,
    args,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a remote runner.
 *
 * @param {{ host: string, port: number, protocol?: string, name?: string }} opts
 * @returns {object} Runner with execute/getStatus
 */
export function createRemoteRunner({ host, port, protocol = 'http', name = 'remote-runner' }) {
  const type = 'remote';

  async function execute({ taskId, command, args = [] }) {
    const payload = buildExecutePayload({ taskId, command, args });
    // Real implementation would POST to http://${host}:${port}/api/execute
    return {
      taskId,
      status: 'error',
      error: `Remote execution not available (would connect to ${host}:${port})`,
      timestamp: new Date().toISOString(),
    };
  }

  function getStatus() {
    return { name, type, host, port, protocol };
  }

  return { name, type, execute, getStatus };
}
