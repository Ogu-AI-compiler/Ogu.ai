/**
 * Message Broker — pub-sub broker with topic pattern routing.
 */

export function createMessageBroker() {
  const subscriptions = new Map(); // topic → Set<handler>
  let totalPublished = 0;

  function subscribe(topic, handler) {
    if (!subscriptions.has(topic)) subscriptions.set(topic, new Set());
    subscriptions.get(topic).add(handler);
    return () => {
      const subs = subscriptions.get(topic);
      if (subs) subs.delete(handler);
    };
  }

  function publish(topic, message) {
    totalPublished++;
    for (const [pattern, handlers] of subscriptions) {
      if (matchTopic(pattern, topic)) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    }
  }

  function matchTopic(pattern, topic) {
    if (pattern === topic) return true;
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      const topicPrefix = topic.substring(0, topic.lastIndexOf("."));
      return topicPrefix === prefix;
    }
    if (pattern.endsWith(".**")) {
      const prefix = pattern.slice(0, -3);
      return topic.startsWith(prefix + ".") || topic === prefix;
    }
    return false;
  }

  function getStats() {
    return {
      topicCount: subscriptions.size,
      totalPublished,
    };
  }

  return { subscribe, publish, getStats };
}
