/**
 * Message Serializer — serialize/deserialize messages in various formats.
 */

/**
 * @param {{ format: 'json' | 'envelope' }} opts
 */
export function createSerializer({ format = "json" } = {}) {
  function serialize(message) {
    if (format === "envelope") {
      const envelope = {
        timestamp: Date.now(),
        id: `msg-${Math.random().toString(36).slice(2, 10)}`,
        payload: message,
      };
      return JSON.stringify(envelope);
    }
    return JSON.stringify(message);
  }

  function deserialize(data) {
    const parsed = JSON.parse(data); // throws on invalid
    return parsed;
  }

  return { serialize, deserialize };
}
