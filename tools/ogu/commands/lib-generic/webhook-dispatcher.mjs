/**
 * Webhook Dispatcher — register and dispatch webhooks.
 */
export function createWebhookDispatcher() {
  const hooks = new Map();
  const log = [];
  function register(event, url, secret = '') {
    if (!hooks.has(event)) hooks.set(event, []);
    hooks.get(event).push({ url, secret });
  }
  function dispatch(event, payload) {
    const targets = hooks.get(event) || [];
    const results = targets.map(t => {
      log.push({ event, url: t.url, payload, time: Date.now() });
      return { url: t.url, delivered: true };
    });
    return results;
  }
  function getLog() { return [...log]; }
  function listEvents() { return [...hooks.keys()]; }
  function unregister(event) { hooks.delete(event); }
  return { register, dispatch, getLog, listEvents, unregister };
}
