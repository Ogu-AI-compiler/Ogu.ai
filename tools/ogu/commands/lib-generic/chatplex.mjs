/**
 * Chatplex — multi-target chat routing for Studio.
 *
 * Routes messages to specific agent channels or broadcasts to all.
 * Supports agent and human channel types.
 */

/**
 * Channel types.
 */
export const CHANNEL_TYPES = {
  agent: { description: 'AI agent channel' },
  human: { description: 'Human operator channel' },
  broadcast: { description: 'All-hands broadcast' },
};

/**
 * Create a channel definition.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.name
 * @param {string} opts.roleId
 * @param {string} [opts.model]
 * @param {string} [opts.type]
 * @returns {{ id, name, roleId, model, type }}
 */
export function createChannel({ id, name, roleId, model, type } = {}) {
  return {
    id,
    name: name || id,
    roleId: roleId || 'unknown',
    model: model || null,
    type: type || 'agent',
  };
}

/**
 * Route a message to a specific channel.
 *
 * @param {object} opts
 * @param {string} opts.message
 * @param {Array} opts.channels
 * @param {string} opts.targetId
 * @returns {{ channelId, message, timestamp }}
 */
export function routeMessage({ message, channels, targetId } = {}) {
  const channel = channels.find(c => c.id === targetId);
  return {
    channelId: channel ? channel.id : targetId,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Broadcast a message to all channels.
 *
 * @param {object} opts
 * @param {string} opts.message
 * @param {Array} opts.channels
 * @returns {Array<{ channelId, message, timestamp }>}
 */
export function broadcastMessage({ message, channels } = {}) {
  return channels.map(ch => ({
    channelId: ch.id,
    message,
    timestamp: new Date().toISOString(),
  }));
}
