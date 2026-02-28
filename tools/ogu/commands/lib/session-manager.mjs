/**
 * Session Manager — manage agent sessions with timeout.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a session manager.
 *
 * @returns {object} Manager with create/get/destroy/listActive/touch
 */
export function createSessionManager() {
  const sessions = new Map();

  function create(data = {}) {
    const id = randomUUID().slice(0, 12);
    sessions.set(id, {
      id,
      ...data,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      active: true,
    });
    return id;
  }

  function get(id) {
    const session = sessions.get(id);
    if (!session || !session.active) return null;
    return session;
  }

  function destroy(id) {
    const session = sessions.get(id);
    if (session) session.active = false;
  }

  function listActive() {
    return Array.from(sessions.values()).filter(s => s.active);
  }

  function touch(id) {
    const session = sessions.get(id);
    if (session) session.lastActivity = Date.now();
  }

  return { create, get, destroy, listActive, touch };
}
