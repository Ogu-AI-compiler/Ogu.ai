/**
 * Handoff Protocol — structured agent-to-agent task transfer.
 */

import { randomUUID } from 'node:crypto';

export const HANDOFF_PRIORITIES = ['critical', 'high', 'normal', 'low'];

/**
 * Create a handoff protocol manager.
 *
 * @returns {object} Protocol with initiateHandoff/completeHandoff/listActive/getHandoff
 */
export function createHandoffProtocol() {
  const handoffs = new Map(); // id → handoff record

  function initiateHandoff({ fromAgent, toAgent, taskId, context, priority = 'normal' }) {
    const id = randomUUID().slice(0, 12);
    const record = {
      id,
      fromAgent,
      toAgent,
      taskId,
      context,
      priority,
      status: 'pending',
      result: null,
      notes: null,
      initiatedAt: new Date().toISOString(),
      completedAt: null,
    };
    handoffs.set(id, record);
    return record;
  }

  function completeHandoff(id, { result, notes } = {}) {
    const record = handoffs.get(id);
    if (!record) throw new Error(`Handoff ${id} not found`);

    record.status = 'completed';
    record.result = result || null;
    record.notes = notes || null;
    record.completedAt = new Date().toISOString();
    return record;
  }

  function listActive() {
    return Array.from(handoffs.values())
      .filter(h => h.status === 'pending');
  }

  function getHandoff(id) {
    return handoffs.get(id) || null;
  }

  return { initiateHandoff, completeHandoff, listActive, getHandoff };
}
