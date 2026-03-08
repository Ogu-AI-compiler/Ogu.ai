/**
 * IPC Channel — inter-process communication channel.
 */
export function createIPCChannel(name) {
  const buffer = [];
  let closed = false;
  const listeners = [];
  function send(msg) {
    if (closed) throw new Error('Channel closed');
    buffer.push(msg);
    listeners.forEach(fn => fn(msg));
  }
  function receive() {
    return buffer.shift() || null;
  }
  function onMessage(fn) { listeners.push(fn); }
  function close() { closed = true; }
  function isClosed() { return closed; }
  function pending() { return buffer.length; }
  function getName() { return name; }
  return { send, receive, onMessage, close, isClosed, pending, getName };
}
