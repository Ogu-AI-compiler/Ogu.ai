/**
 * Mailbox — message queue for actor communication.
 */
export function createMailbox() {
  const messages = [];
  function deliver(msg) { messages.push(msg); }
  function read() { return messages.length > 0 ? messages.shift() : null; }
  function peek() { return messages.length > 0 ? messages[0] : null; }
  function pending() { return messages.length; }
  function clear() { messages.length = 0; }
  return { deliver, read, peek, pending, clear };
}
