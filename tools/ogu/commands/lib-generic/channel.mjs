/**
 * Channel — Go-style unbuffered channel for message passing.
 */
export function createChannel() {
  const buffer = [];
  let closed = false;
  function send(value) {
    if (closed) return false;
    buffer.push(value);
    return true;
  }
  function receive() {
    if (buffer.length === 0) return null;
    return buffer.shift();
  }
  function close() { closed = true; }
  function isClosed() { return closed; }
  function pending() { return buffer.length; }
  return { send, receive, close, isClosed, pending };
}
