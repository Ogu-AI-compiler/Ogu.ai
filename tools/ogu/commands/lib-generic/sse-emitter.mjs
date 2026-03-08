/**
 * SSE Emitter — Server-Sent Events emitter.
 */
export function createSSEEmitter() {
  const clients = new Map();
  let nextId = 1;
  let eventId = 0;
  function addClient(callback) { const id = nextId++; clients.set(id, callback); return id; }
  function removeClient(id) { clients.delete(id); }
  function emit(event, data) {
    eventId++;
    const msg = { id: eventId, event, data };
    for (const [, cb] of clients) cb(msg);
    return eventId;
  }
  function format(msg) {
    let str = '';
    if (msg.id) str += `id: ${msg.id}\n`;
    if (msg.event) str += `event: ${msg.event}\n`;
    str += `data: ${typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)}\n\n`;
    return str;
  }
  function clientCount() { return clients.size; }
  return { addClient, removeClient, emit, format, clientCount };
}
