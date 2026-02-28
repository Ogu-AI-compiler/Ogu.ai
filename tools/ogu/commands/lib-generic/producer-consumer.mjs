/**
 * Producer Consumer — tracked producer/consumer pattern.
 */
export function createProducerConsumer(capacity) {
  const buffer = [];
  let produced = 0, consumed = 0;
  function produce(item) {
    if (buffer.length < capacity) { buffer.push(item); produced++; return true; }
    return false;
  }
  function consume() {
    if (buffer.length > 0) { consumed++; return buffer.shift(); }
    return null;
  }
  function getStats() { return { produced, consumed, buffered: buffer.length, capacity }; }
  return { produce, consume, getStats };
}
