/**
 * Stream Cursor Manager — track client position in event streams for resume.
 */

/**
 * Create a stream cursor manager.
 *
 * @returns {object} Manager with setCursor/getCursor/getAllCursors/removeCursors
 */
export function createStreamCursorManager() {
  const cursors = new Map(); // clientId → Map<streamKey, seq>

  function setCursor(clientId, streamKey, seq) {
    if (!cursors.has(clientId)) cursors.set(clientId, new Map());
    cursors.get(clientId).set(streamKey, seq);
  }

  function getCursor(clientId, streamKey) {
    const client = cursors.get(clientId);
    if (!client) return 0;
    return client.get(streamKey) || 0;
  }

  function getAllCursors(clientId) {
    const client = cursors.get(clientId);
    if (!client) return {};
    return Object.fromEntries(client);
  }

  function removeCursors(clientId) {
    cursors.delete(clientId);
  }

  function listClients() {
    return Array.from(cursors.keys());
  }

  return { setCursor, getCursor, getAllCursors, removeCursors, listClients };
}
