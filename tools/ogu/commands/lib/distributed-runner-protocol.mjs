/**
 * distributed-runner-protocol.mjs — Message protocol for distributed runner coordination.
 */
export function createRunnerProtocol() {
  const handlers = new Map();

  return {
    onMessage(type, handler) { handlers.set(type, handler); },
    handleMessage(msg) {
      const handler = handlers.get(msg?.type) || handlers.get('*');
      return handler ? handler(msg) : null;
    },
    createTaskMessage: (taskId, payload) => ({ type: 'task.dispatch', taskId, payload, timestamp: new Date().toISOString() }),
    createHeartbeat: (runnerId) => ({ type: 'runner.heartbeat', runnerId, timestamp: new Date().toISOString() }),
    createResult: (taskId, result) => ({ type: 'task.result', taskId, result, timestamp: new Date().toISOString() }),
  };
}
