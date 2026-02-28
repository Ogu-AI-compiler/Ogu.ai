/**
 * Webhook Manager — register and dispatch webhooks on events.
 */

let nextId = 1;

/**
 * Create a webhook manager.
 *
 * @returns {object} Manager with register/unregister/dispatch/listWebhooks
 */
export function createWebhookManager() {
  const webhooks = new Map();

  function register({ event, url, secret, handler }) {
    const id = `wh-${nextId++}`;
    webhooks.set(id, { id, event, url, secret, handler });
    return { id, event, url };
  }

  function unregister(id) {
    webhooks.delete(id);
  }

  function dispatch(event, payload) {
    const results = [];
    for (const [, hook] of webhooks) {
      if (hook.event === event) {
        if (hook.handler) hook.handler(payload);
        results.push({ id: hook.id, url: hook.url });
      }
    }
    return results;
  }

  function listWebhooks() {
    return Array.from(webhooks.values()).map(({ id, event, url }) => ({ id, event, url }));
  }

  return { register, unregister, dispatch, listWebhooks };
}
