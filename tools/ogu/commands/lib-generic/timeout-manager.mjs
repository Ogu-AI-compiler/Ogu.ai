/**
 * Timeout Manager — manage operation timeouts with cancellation.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a timeout manager.
 *
 * @returns {object} Manager with setTimeout/clearTimeout/isExpired/listActive
 */
export function createTimeoutManager() {
  const timeouts = new Map(); // id → { name, expiresAt }

  function setTimeout(name, durationMs) {
    const id = randomUUID().slice(0, 8);
    timeouts.set(id, {
      id,
      name,
      expiresAt: Date.now() + durationMs,
      createdAt: Date.now(),
    });
    return id;
  }

  function clearTimeout(id) {
    timeouts.delete(id);
  }

  function isExpired(id) {
    const t = timeouts.get(id);
    if (!t) return true;
    return Date.now() > t.expiresAt;
  }

  function listActive() {
    const now = Date.now();
    return Array.from(timeouts.values()).filter(t => now <= t.expiresAt);
  }

  return { setTimeout, clearTimeout, isExpired, listActive };
}
