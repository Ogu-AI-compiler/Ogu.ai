/**
 * Protocol Handler — handle protocol-specific operations.
 */

/**
 * @param {{ protocol: string }} opts
 */
export function createProtocolHandler({ protocol }) {
  const handlers = new Map();
  let receivedCount = 0;
  let sentCount = 0;

  function onMessage(type, handler) {
    if (!handlers.has(type)) handlers.set(type, []);
    handlers.get(type).push(handler);
  }

  function receive(type, message) {
    receivedCount++;
    const fns = handlers.get(type);
    if (fns) {
      for (const fn of fns) fn(message);
    }
  }

  function send(type, payload) {
    sentCount++;
    return {
      type,
      protocol,
      encoded: JSON.stringify(payload),
      sentAt: Date.now(),
    };
  }

  function getStats() {
    return {
      protocol,
      received: receivedCount,
      sent: sentCount,
      handlerTypes: handlers.size,
    };
  }

  return { onMessage, receive, send, getStats };
}
