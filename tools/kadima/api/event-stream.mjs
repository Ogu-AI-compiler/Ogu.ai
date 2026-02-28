/**
 * SSE Event Broadcaster — pushes real-time events to connected clients.
 *
 * Uses Server-Sent Events (text/event-stream) — no external deps.
 *
 * Usage:
 *   const broadcaster = createBroadcaster();
 *   // Add SSE client in router:
 *   broadcaster.addClient(res, { feature: 'optional-filter' });
 *   // Broadcast from anywhere:
 *   broadcaster.broadcast({ type: 'task:dispatched', ... });
 */

export function createBroadcaster() {
  /** @type {Set<{ res: import('http').ServerResponse, filter?: { feature?: string } }>} */
  const clients = new Set();

  /**
   * Add an SSE client connection.
   * @param {import('http').ServerResponse} res
   * @param {{ feature?: string }} [filter]
   */
  function addClient(res, filter = {}) {
    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const client = { res, filter };
    clients.add(client);

    // Send connected event
    const connected = {
      type: 'connected',
      timestamp: new Date().toISOString(),
      clientCount: clients.size,
    };
    res.write(`data: ${JSON.stringify(connected)}\n\n`);

    // Remove on disconnect
    res.on('close', () => {
      clients.delete(client);
    });
  }

  /**
   * Broadcast an event to all connected SSE clients.
   * @param {object} event — must have `type` field
   */
  function broadcast(event) {
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    const msg = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of clients) {
      // Apply feature filter if set
      if (client.filter?.feature) {
        const featureSlug =
          event.payload?.featureSlug ||
          event.payload?.slug ||
          event.feature;
        if (featureSlug && featureSlug !== client.filter.feature) {
          continue;
        }
      }

      try {
        client.res.write(msg);
      } catch {
        // Client disconnected — remove it
        clients.delete(client);
      }
    }
  }

  /**
   * Get current client count.
   */
  function clientCount() {
    return clients.size;
  }

  return { addClient, broadcast, clientCount };
}
