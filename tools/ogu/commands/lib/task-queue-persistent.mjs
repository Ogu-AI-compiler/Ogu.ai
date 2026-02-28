/**
 * Task Queue Persistent — file-backed task queue with resume support.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Create a persistent file-backed queue.
 *
 * @param {{ path: string }} opts
 * @returns {object} Queue with enqueue/dequeue/peek/size/flush
 */
export function createPersistentQueue({ path }) {
  let items = [];

  // Load existing data if file exists
  if (existsSync(path)) {
    try {
      const data = readFileSync(path, 'utf8').trim();
      if (data) {
        items = data.split('\n').map(line => JSON.parse(line));
      }
    } catch (_) {}
  }

  function enqueue(item) {
    items.push(item);
  }

  function dequeue() {
    return items.shift() || null;
  }

  function peek() {
    return items[0] || null;
  }

  function size() {
    return items.length;
  }

  function flush() {
    writeFileSync(path, items.map(i => JSON.stringify(i)).join('\n') + '\n', 'utf8');
  }

  return { enqueue, dequeue, peek, size, flush };
}
