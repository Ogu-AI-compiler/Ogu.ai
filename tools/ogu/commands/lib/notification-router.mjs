/**
 * Notification Router — route notifications to channels by type.
 *
 * Supports multiple channels per type and wildcard ("*") default routing.
 */

/**
 * Create a notification router.
 *
 * @returns {object} Router with addRoute/route
 */
export function createNotificationRouter() {
  const routes = []; // { type, channel, handler }

  function addRoute({ type, channel, handler }) {
    routes.push({ type, channel, handler });
  }

  function route({ type, message, metadata }) {
    const matching = routes.filter(r => r.type === type);
    const targets = matching.length > 0 ? matching : routes.filter(r => r.type === '*');

    const results = [];
    for (const target of targets) {
      target.handler({ type, message, metadata });
      results.push({ channel: target.channel });
    }
    return results;
  }

  return { addRoute, route };
}
